"""Matching algorithms for MOS2 flakes.

The viewer deliberately does not know how a match is found. New approaches can
implement the same matcher interface later, for example an analytical matcher,
a feature/RANSAC matcher, or a machine-learning detector.
"""

from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Callable, Optional, Protocol, Tuple

try:
    import numpy as np
except ImportError:
    np = None


Rectangle = Tuple[int, int, int, int]
ProgressCallback = Callable[[float, str], None]


class PixelSource(Protocol):
    """The pixel access that a matcher needs from a large image."""

    width: int
    height: int

    def read_gray_samples(self, x, y):
        """Return grayscale pixels at broadcast-compatible coordinates."""

    def read_rgb_array(self, x: int, y: int, width: int, height: int):
        """Return an RGB array for one rectangular source region."""


@dataclass(frozen=True)
class PixelTemplate:
    """Immutable RGB pixels used as the search template.

    This deliberately contains no source image, path, or selection position.
    The viewer keeps this object in memory only while a search is running.
    """

    width: int
    height: int
    rgb_pixels: bytes

    def __post_init__(self):
        if self.width < 1 or self.height < 1:
            raise ValueError("A pixel template must have positive dimensions.")

        pixels = bytes(self.rgb_pixels)
        expected_length = self.width * self.height * 3
        if len(pixels) != expected_length:
            raise ValueError(
                "Template pixel data does not match its dimensions: "
                f"expected {expected_length} bytes, got {len(pixels)}."
            )
        object.__setattr__(self, "rgb_pixels", pixels)


@dataclass(frozen=True)
class MatchResult:
    """One candidate location. Lower scores indicate closer pixel agreement."""

    x: int
    y: int
    width: int
    height: int
    score: float


@dataclass(frozen=True)
class MatchReport:
    """Search diagnostics, including distinct candidates rejected by the threshold."""

    match: Optional[MatchResult]
    top_matches: Tuple[MatchResult, ...]
    rejection_reason: Optional[str] = None


class Matcher(Protocol):
    def find(
        self,
        source: PixelSource,
        template: PixelTemplate,
        excluded_region: Optional[Rectangle] = None,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> Optional[MatchResult]:
        """Find the template using pixels, optionally ignoring one rectangle."""


class AnalyticalMatcher:
    """Coarse-to-fine, same-scale pixel matcher for the first prototype.

    The coarse pass correlates real source pixels on a bounded overview, so it
    can search a large image without constructing every possible full-size
    comparison. The refinement pass then samples a small full-resolution
    neighborhood and validates the winner against every RGB channel.
    """

    MAX_TEMPLATE_PIXELS = 4_000_000
    MAX_OVERVIEW_DIMENSION = 1536
    MIN_OVERVIEW_TEMPLATE_DIMENSION = 8
    MAX_COARSE_CANDIDATES = 250_000
    COARSE_SAMPLE_GRID = 24
    REFINE_SAMPLE_GRID = 48
    COARSE_WORKING_BYTES = 32 * 1024 * 1024
    REFINE_WORKING_BYTES = 32 * 1024 * 1024
    CANDIDATES_TO_REFINE = 16
    LOCAL_CANDIDATES_TO_VALIDATE = 6
    TOP_CANDIDATES_TO_REPORT = 5
    MIN_SCORE_MARGIN = 0.005

    def __init__(self, max_score: Optional[float] = 0.05):
        # This is a provisional acceptance gate. It should be calibrated from
        # known overlaps rather than treated as a universal microscope limit.
        if max_score is not None and not 0.0 <= max_score <= 1.0:
            raise ValueError("max_score must be between 0 and 1, or None.")
        self.max_score = max_score

    # ===== Public search interface =====
    def find(
        self,
        source: PixelSource,
        template: PixelTemplate,
        excluded_region: Optional[Rectangle] = None,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> Optional[MatchResult]:
        """Return the accepted match while keeping the old matcher interface."""
        return self.find_report(
            source,
            template,
            excluded_region,
            progress_callback,
        ).match

    # ===== Search pipeline =====
    def find_report(
        self,
        source: PixelSource,
        template: PixelTemplate,
        excluded_region: Optional[Rectangle] = None,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> MatchReport:
        """Search the image and return both the decision and its evidence."""
        if np is None:
            raise RuntimeError(
                "NumPy is required for the analytical matcher. "
                "Install it into the same Python environment that runs the app."
            )

        if template.width > source.width or template.height > source.height:
            return MatchReport(
                None,
                (),
                "The selected template is larger than the source image.",
            )
        if template.width * template.height > self.MAX_TEMPLATE_PIXELS:
            raise ValueError(
                "The selected template is too large for this first matcher. "
                f"Select at most {self.MAX_TEMPLATE_PIXELS:,} pixels."
            )

        self._report(progress_callback, 0.0, "starting")
        excluded = self._validate_excluded_region(source, excluded_region)

        # The template is copied into NumPy once so later comparisons do not
        # repeatedly decode the selected bytes.
        template_rgb = np.frombuffer(
            template.rgb_pixels,
            dtype=np.uint8,
        ).reshape(template.height, template.width, 3)

        # Grayscale is enough for the fast search and avoids doing three FFTs.
        template_gray = self._to_grayscale(template_rgb)
        template_rgb_float = template_rgb.astype(np.float32)

        overview_result = self._overview_candidates(
            source,
            template,
            template_gray,
            excluded,
            progress_callback,
        )
        if overview_result is not None:
            coarse_candidates, refinement_radius = overview_result
        else:
            # A tiny template would disappear in the bounded overview, so use
            # sampled full-resolution pixels as the coarse search instead.
            sample_x = self._sample_indices(template.width)
            sample_y = self._sample_indices(template.height)
            sampled_template = template_gray[np.ix_(sample_y, sample_x)]
            refinement_radius = self._choose_coarse_stride(source, template)
            candidate_x = self._candidate_positions(
                source.width - template.width,
                refinement_radius,
            )
            candidate_y = self._candidate_positions(
                source.height - template.height,
                refinement_radius,
            )
            coarse_candidates = self._coarse_candidates(
                source,
                template,
                sampled_template,
                sample_x,
                sample_y,
                candidate_x,
                candidate_y,
                excluded,
                progress_callback,
            )

        # Keep the final RGB score for every refined location. Rejected results
        # are still useful because the GUI can show why the decision was made.
        results = []
        total_candidates = max(1, len(coarse_candidates))
        for candidate_index, (coarse_x, coarse_y) in enumerate(coarse_candidates):
            result = self._refine_candidate(
                source,
                template,
                template_gray,
                template_rgb_float,
                coarse_x,
                coarse_y,
                refinement_radius,
                excluded,
                progress_callback,
                0.55 + 0.40 * candidate_index / total_candidates,
                0.40 / total_candidates,
            )
            if result is not None:
                results.append(result)
            self._report(
                progress_callback,
                0.55 + 0.40 * (candidate_index + 1) / total_candidates,
                "refining candidates",
            )

        if not results:
            self._report(progress_callback, 1.0, "no match")
            return MatchReport(
                None,
                (),
                "No candidate survived the full-resolution comparison.",
            )

        # A coarse candidate can be reached more than once, especially near an
        # edge. Keep only the best score for each actual source coordinate.
        unique_results = {}
        for result in results:
            key = (result.x, result.y)
            if key not in unique_results or result.score < unique_results[key].score:
                unique_results[key] = result
        ordered_results = sorted(unique_results.values(), key=lambda item: item.score)
        # Report the actual top scores, including nearby offsets, so the user
        # can see how tightly the best location is determined.
        top_matches = tuple(ordered_results[: self.TOP_CANDIDATES_TO_REPORT])

        # Neighboring offsets are usually one match basin, not independent
        # answers. Use spatially distinct candidates for the ambiguity check.
        distinct_matches = self._select_distinct_matches(ordered_results, template)
        best = ordered_results[0]

        # This first gate answers whether the best candidate is close enough to
        # the selected pixels to be considered the same image patch.
        if self.max_score is not None and best.score > self.max_score:
            self._report(progress_callback, 1.0, "no convincing match")
            return MatchReport(
                None,
                top_matches,
                f"Best score {best.score:.4f} exceeds the limit "
                f"{self.max_score:.4f}.",
            )

        # A low score is not enough if another location scores almost as well.
        # The margin prevents a visually ambiguous answer from being presented
        # as if it were uniquely identified.
        if (
            self.max_score is not None
            and len(distinct_matches) > 1
            and best.score > 0.0
            and distinct_matches[1].score - best.score < self.MIN_SCORE_MARGIN
        ):
            self._report(progress_callback, 1.0, "no convincing match")
            return MatchReport(
                None,
                top_matches,
                f"The best two scores differ by only "
                f"{distinct_matches[1].score - best.score:.4f}.",
            )
        self._report(progress_callback, 1.0, "finished")
        return MatchReport(best, top_matches)

    # ===== Progress and pixel helpers =====
    @staticmethod
    def _report(progress_callback, fraction: float, phase: str):
        if progress_callback is None:
            return
        progress_callback(min(1.0, max(0.0, float(fraction))), phase)

    @staticmethod
    def _to_grayscale(rgb_pixels):
        """Convert RGB pixels to luminance for the fast matching passes."""
        return (
            rgb_pixels[..., 0].astype(np.float32) * 0.299
            + rgb_pixels[..., 1].astype(np.float32) * 0.587
            + rgb_pixels[..., 2].astype(np.float32) * 0.114
        )

    @staticmethod
    def _nearest_resize_gray(gray_pixels, output_width: int, output_height: int):
        """Resize a grayscale array by selecting the nearest source samples."""
        # Nearest sampling keeps the overview cheap and does not invent new
        # intensity values before the coarse search.
        columns = np.minimum(
            gray_pixels.shape[1] - 1,
            ((np.arange(output_width) + 0.5) * gray_pixels.shape[1] / output_width)
            .astype(np.int64),
        )
        rows = np.minimum(
            gray_pixels.shape[0] - 1,
            ((np.arange(output_height) + 0.5) * gray_pixels.shape[0] / output_height)
            .astype(np.int64),
        )
        return gray_pixels[np.ix_(rows, columns)]

    # ===== Overview search =====
    def _overview_candidates(
        self,
        source: PixelSource,
        template: PixelTemplate,
        template_gray,
        excluded,
        progress_callback,
    ):
        render_region = getattr(source, "render_region", None)
        if render_region is None:
            return None

        self._report(progress_callback, 0.05, "building overview")

        # The overview has a fixed maximum dimension, so its memory cost is
        # controlled even when the source image grows much larger.
        scale = min(
            1.0,
            self.MAX_OVERVIEW_DIMENSION / max(source.width, source.height),
        )
        overview_width = max(1, round(source.width * scale))
        overview_height = max(1, round(source.height * scale))
        template_width = max(1, round(template.width * overview_width / source.width))
        template_height = max(
            1,
            round(template.height * overview_height / source.height),
        )
        if min(template_width, template_height) < self.MIN_OVERVIEW_TEMPLATE_DIMENSION:
            return None

        # The source reader performs the downsampling without exposing the full
        # BMP as one Python object.
        overview_rgb = np.frombuffer(
            render_region(
                0,
                0,
                source.width,
                source.height,
                overview_width,
                overview_height,
            ),
            dtype=np.uint8,
        ).reshape(overview_height, overview_width, 3)
        overview_gray = self._to_grayscale(overview_rgb)
        self._report(progress_callback, 0.25, "overview ready")
        small_template = self._nearest_resize_gray(
            template_gray,
            template_width,
            template_height,
        )

        # Padding prevents the FFT convolution from wrapping one image edge
        # around to the opposite edge.
        fft_shape = (
            overview_height + template_height - 1,
            overview_width + template_width - 1,
        )

        # Multiplication in Fourier space is equivalent to sliding correlation
        # in image space, but calculates all offsets in a small number of steps.
        source_fft = np.fft.rfftn(overview_gray, fft_shape)

        # Flipping the template changes convolution into correlation, which is
        # the operation needed to compare the template at every offset.
        template_fft = np.fft.rfftn(small_template[::-1, ::-1], fft_shape)

        # The inverse transform contains one correlation value for each offset.
        correlation = np.fft.irfftn(
            source_fft * template_fft,
            fft_shape,
        )
        del source_fft, template_fft
        # Discard offsets where the template would extend outside the overview.
        correlation = correlation[
            template_height - 1 : overview_height,
            template_width - 1 : overview_width,
        ]

        # An integral image gives the sum of every sliding source window in
        # constant time after one cumulative-sum pass.
        source_squared_integral = self._integral_image(overview_gray**2)

        # Inclusion and exclusion of the four corners extracts each window's
        # squared-pixel sum from the padded integral image.
        source_window_squared_sum = (
            source_squared_integral[template_height:, template_width:]
            - source_squared_integral[:-template_height, template_width:]
            - source_squared_integral[template_height:, :-template_width]
            + source_squared_integral[:-template_height, :-template_width]
        )
        template_squared_sum = float(np.sum(small_template**2, dtype=np.float64))

        # SSD expands as source squared sum minus twice the correlation plus
        # template squared sum. Division puts scores on a roughly 0 to 1 scale.
        scores = (
            source_window_squared_sum
            - 2.0 * correlation
            + template_squared_sum
        ) / (template_width * template_height * 255.0**2)
        scores = np.maximum(scores, 0.0)
        self._report(progress_callback, 0.50, "coarse correlation complete")

        # Each overview coordinate represents a small source-image rectangle.
        # Map its top-left coordinate back to the original pixel grid.
        source_x = np.minimum(
            source.width - template.width,
            np.rint(np.arange(scores.shape[1]) / (overview_width / source.width))
            .astype(np.int64),
        )
        source_y = np.minimum(
            source.height - template.height,
            np.rint(np.arange(scores.shape[0]) / (overview_height / source.height))
            .astype(np.int64),
        )
        if excluded is not None:
            excluded_x, excluded_y, excluded_width, excluded_height = excluded

            # Mark every candidate whose rectangle intersects the selected area
            # so the search cannot win by returning the template itself.
            overlaps_x = (
                (source_x[None, :] < excluded_x + excluded_width)
                & (source_x[None, :] + template.width > excluded_x)
            )
            overlaps_y = (
                (source_y[:, None] < excluded_y + excluded_height)
                & (source_y[:, None] + template.height > excluded_y)
            )
            scores[overlaps_y & overlaps_x] = np.inf

        finite_indices = np.flatnonzero(np.isfinite(scores.ravel()))
        if finite_indices.size == 0:
            return [], max(
                1,
                math.ceil(2.0 / (overview_width / source.width)),
                math.ceil(2.0 / (overview_height / source.height)),
            )

        # Partial sorting finds the smallest scores without sorting the entire
        # overview score array.
        take = min(self.CANDIDATES_TO_REFINE, finite_indices.size)
        finite_scores = scores.ravel()[finite_indices]
        chosen = np.argpartition(finite_scores, take - 1)[:take]
        candidates = []
        for flat_index in finite_indices[chosen]:
            overview_y, overview_x = np.unravel_index(flat_index, scores.shape)
            candidates.append(
                (
                    int(source_x[overview_x]),
                    int(source_y[overview_y]),
                )
            )

        # Coarse coordinates are rounded to overview pixels, so search a small
        # source neighborhood around each one to recover the exact offset.
        refinement_radius = max(
            1,
            math.ceil(2.0 / (overview_width / source.width)),
            math.ceil(2.0 / (overview_height / source.height)),
        )
        return list(dict.fromkeys(candidates)), refinement_radius

    # ===== Candidate ranking =====
    def _select_distinct_matches(self, ordered_results, template):
        """Keep the best candidates from separate spatial neighborhoods."""
        separation = max(4, min(template.width, template.height) // 2)
        selected = []

        for candidate in ordered_results:
            # A few-pixel shift can be caused by alignment uncertainty. Do not
            # count that shift as a second independent answer.
            near_existing = any(
                max(
                    abs(candidate.x - previous.x),
                    abs(candidate.y - previous.y),
                )
                < separation
                for previous in selected
            )
            if near_existing:
                continue

            selected.append(candidate)
            if len(selected) == self.TOP_CANDIDATES_TO_REPORT:
                break

        return selected

    # ===== Sparse fallback and candidate grids =====
    @staticmethod
    def _integral_image(values):
        """Build a zero-padded summed-area table for sliding-window sums."""
        # The leading zero row and column make the four-corner formula work at
        # the image boundary without special cases.
        padded = np.pad(values, ((1, 0), (1, 0)), mode="constant")
        # Cumulative sums turn any axis-aligned rectangle sum into four table
        # lookups and additions.
        return padded.cumsum(axis=0, dtype=np.float64).cumsum(
            axis=1,
            dtype=np.float64,
        )

    def _sample_indices(self, length: int, grid_size: Optional[int] = None):
        """Return evenly spaced source indices for a bounded comparison grid."""
        count = min(grid_size or self.COARSE_SAMPLE_GRID, length)
        # Including both endpoints preserves features near either template edge.
        return np.unique(
            np.rint(np.linspace(0, length - 1, count)).astype(np.int64)
        )

    def _choose_coarse_stride(self, source: PixelSource, template: PixelTemplate):
        """Choose a scan stride that keeps the fallback candidate count bounded."""
        stride = max(1, min(template.width, template.height) // 8)
        max_x = source.width - template.width
        max_y = source.height - template.height

        while True:
            x_count = max_x // stride + 1
            y_count = max_y // stride + 1
            candidate_count = x_count * y_count
            if candidate_count <= self.MAX_COARSE_CANDIDATES:
                return stride

            # Increase the stride by the square-root of the excess area so the
            # two-dimensional candidate count falls toward the target quickly.
            multiplier = math.ceil(
                math.sqrt(candidate_count / self.MAX_COARSE_CANDIDATES)
            )
            stride = max(stride + 1, stride * multiplier)

    @staticmethod
    def _candidate_positions(max_start: int, stride: int):
        """Return scan positions and always include the final legal position."""
        positions = np.arange(0, max_start + 1, stride, dtype=np.int64)
        if positions[-1] != max_start:
            positions = np.append(positions, max_start)
        return positions

    def _coarse_candidates(
        self,
        source: PixelSource,
        template: PixelTemplate,
        sampled_template,
        sample_x,
        sample_y,
        candidate_x,
        candidate_y,
        excluded,
        progress_callback,
    ):
        """Scan sampled pixels when an overview search is unavailable."""
        feature_count = sampled_template.size
        # Batch rows so the broadcasted source array stays within a fixed
        # working-memory budget on large images.
        batch_size = max(
            1,
            self.COARSE_WORKING_BYTES
            // max(1, 2 * len(candidate_x) * feature_count * 4),
        )
        candidates = []

        for start in range(0, len(candidate_y), batch_size):
            batch_y = candidate_y[start : start + batch_size]
            # Broadcasting creates one sampled template-sized grid per source
            # candidate without Python loops over individual pixels.
            row_indices = batch_y[:, None, None, None] + sample_y[
                None, None, :, None
            ]
            column_indices = candidate_x[None, :, None, None] + sample_x[
                None, None, None, :
            ]
            sampled_source = source.read_gray_samples(column_indices, row_indices)
            # Mean absolute grayscale error is fast enough for the coarse pass.
            scores = np.mean(
                np.abs(sampled_source - sampled_template[None, None, :, :]),
                axis=(2, 3),
            ) / 255.0

            if excluded is not None:
                excluded_x, excluded_y, excluded_width, excluded_height = excluded
                # Remove windows that overlap the selected source rectangle.
                overlaps_x = (
                    (candidate_x[None, :] < excluded_x + excluded_width)
                    & (
                        candidate_x[None, :] + template.width
                        > excluded_x
                    )
                )
                overlaps_y = (
                    (batch_y[:, None] < excluded_y + excluded_height)
                    & (batch_y[:, None] + template.height > excluded_y)
                )
                scores[overlaps_y & overlaps_x] = np.inf

            finite_indices = np.flatnonzero(np.isfinite(scores.ravel()))
            if finite_indices.size == 0:
                continue

            # Retain only the most promising positions from this batch.
            take = min(self.CANDIDATES_TO_REFINE, finite_indices.size)
            finite_scores = scores.ravel()[finite_indices]
            chosen = np.argpartition(finite_scores, take - 1)[:take]
            for flat_index in finite_indices[chosen]:
                local_y, local_x = np.unravel_index(flat_index, scores.shape)
                candidates.append(
                    (int(candidate_x[local_x]), int(batch_y[local_y]))
                )
            self._report(
                progress_callback,
                0.05 + 0.45 * (start + len(batch_y)) / len(candidate_y),
                "coarse pixel scan",
            )

        # Several coarse grid points can lead to the same refinement area near
        # an image edge. Deduplicating keeps refinement work predictable.
        return list(dict.fromkeys(candidates))

    # ===== Full-resolution refinement =====
    def _refine_candidate(
        self,
        source: PixelSource,
        template: PixelTemplate,
        template_gray,
        template_rgb_float,
        coarse_x: int,
        coarse_y: int,
        radius: int,
        excluded,
        progress_callback,
        progress_start: float,
        progress_span: float,
    ):
        """Search a small source neighborhood and validate its best positions."""
        max_x = source.width - template.width
        max_y = source.height - template.height

        # The overview identifies a region, not necessarily the exact pixel.
        # Limit the expensive full-resolution work to that local neighborhood.
        left = max(0, coarse_x - radius)
        top = max(0, coarse_y - radius)
        right = min(max_x, coarse_x + radius)
        bottom = min(max_y, coarse_y + radius)

        # A 48 by 48 grid is much cheaper than reading every pixel for every
        # local offset, while still preserving the template's broad structure.
        sample_x = self._sample_indices(
            template.width,
            self.REFINE_SAMPLE_GRID,
        )
        sample_y = self._sample_indices(
            template.height,
            self.REFINE_SAMPLE_GRID,
        )
        sampled_template = template_gray[np.ix_(sample_y, sample_x)]
        candidate_x = np.arange(left, right + 1, dtype=np.int64)
        candidate_y = np.arange(top, bottom + 1, dtype=np.int64)
        feature_count = sampled_template.size
        # The refinement batch uses the same memory cap as the coarse fallback.
        batch_size = max(
            1,
            self.REFINE_WORKING_BYTES
            // max(1, 2 * len(candidate_x) * feature_count * 4),
        )

        local_candidates = []
        for start in range(0, len(candidate_y), batch_size):
            batch_y = candidate_y[start : start + batch_size]
            # Build all sampled candidate grids in one vectorized operation.
            row_indices = batch_y[:, None, None, None] + sample_y[
                None, None, :, None
            ]
            column_indices = candidate_x[None, :, None, None] + sample_x[
                None, None, None, :
            ]
            sampled_source = source.read_gray_samples(column_indices, row_indices)
            # Use grayscale for ranking local offsets, reserving RGB reads for
            # only the handful of positions that will be fully validated.
            scores = np.mean(
                np.abs(sampled_source - sampled_template[None, None, :, :]),
                axis=(2, 3),
            ) / 255.0

            if excluded is not None:
                excluded_x, excluded_y, excluded_width, excluded_height = (
                    excluded
                )
                # The self-match exclusion applies during refinement as well as
                # during the coarse search.
                overlaps_x = (
                    (candidate_x[None, :] < excluded_x + excluded_width)
                    & (candidate_x[None, :] + template.width > excluded_x)
                )
                overlaps_y = (
                    (batch_y[:, None] < excluded_y + excluded_height)
                    & (batch_y[:, None] + template.height > excluded_y)
                )
                scores[overlaps_y & overlaps_x] = np.inf

            finite_indices = np.flatnonzero(np.isfinite(scores.ravel()))
            if finite_indices.size == 0:
                self._report(
                    progress_callback,
                    progress_start
                    + progress_span * (start + len(batch_y)) / len(candidate_y),
                    "refining candidates",
                )
                continue

            # Keep several local winners because the grayscale ranking can tie
            # locations that differ once their RGB pixels are examined.
            take = min(self.LOCAL_CANDIDATES_TO_VALIDATE, finite_indices.size)
            finite_scores = scores.ravel()[finite_indices]
            chosen = np.argpartition(finite_scores, take - 1)[:take]
            for flat_index in finite_indices[chosen]:
                local_y, local_x = np.unravel_index(flat_index, scores.shape)
                local_candidates.append(
                    (
                        float(scores[local_y, local_x]),
                        int(candidate_x[local_x]),
                        int(batch_y[local_y]),
                    )
                )
            self._report(
                progress_callback,
                progress_start
                + progress_span * (start + len(batch_y)) / len(candidate_y),
                "refining candidates",
            )

        if not local_candidates:
            return None

        best_result = None
        candidates_to_validate = sorted(local_candidates)[
            : self.LOCAL_CANDIDATES_TO_VALIDATE
        ]
        for _sample_score, candidate_x, candidate_y in candidates_to_validate:
            # Only these few rectangles need a full-resolution RGB read.
            candidate_rgb = source.read_rgb_array(
                candidate_x,
                candidate_y,
                template.width,
                template.height,
            ).astype(np.float32, copy=False)
            full_score = self._full_rgb_score(
                candidate_rgb,
                template_rgb_float,
            )
            result = MatchResult(
                x=candidate_x,
                y=candidate_y,
                width=template.width,
                height=template.height,
                score=full_score,
            )
            if best_result is None or result.score < best_result.score:
                best_result = result
        return best_result

    # ===== Final score and input validation =====
    @staticmethod
    def _full_rgb_score(candidate_rgb, template_rgb_float):
        """Score RGB agreement while preventing a small mismatch from hiding."""
        # Normalize channel differences so the score is independent of the
        # eight-bit representation's absolute scale.
        absolute_error = np.abs(candidate_rgb - template_rgb_float) / 255.0

        # The mean rewards overall agreement, which is useful for texture and
        # background structure.
        mean_error = float(np.mean(absolute_error))

        # The high percentile stops a visibly wrong region from being hidden by
        # a large amount of uniform silicon background.
        high_error = float(np.percentile(absolute_error, 99.0))

        # The larger value is the conservative final score. Lower is better.
        return max(mean_error, high_error)

    @staticmethod
    def _validate_excluded_region(source: PixelSource, excluded_region):
        """Validate the rectangle used only to block the trivial self-match."""
        if excluded_region is None:
            return None
        if len(excluded_region) != 4:
            raise ValueError("excluded_region must be (x, y, width, height).")
        x, y, width, height = excluded_region
        if width < 1 or height < 1:
            raise ValueError("The excluded region must have positive dimensions.")
        if x < 0 or y < 0 or x + width > source.width or y + height > source.height:
            raise ValueError("The excluded region is outside the source image.")
        return int(x), int(y), int(width), int(height)
