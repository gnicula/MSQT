import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

interface BlochVector {
  x: number;
  y: number;
  z: number;
}

interface BlochSphereProps {
  blochVector: BlochVector;
}

const BlochSphere: React.FC<BlochSphereProps> = ({ blochVector }) => {
  const [data, setData] = useState<any[]>([]);
  const [layout, setLayout] = useState<any>({});

  useEffect(() => {
    setData([
      {
        type: "scatter3d",
        x: [0, blochVector.x],
        y: [0, blochVector.y],
        z: [0, blochVector.z],
        mode: "lines+markers",
        marker: { size: 4 },
        line: { width: 5, color: "red" },
      },
    ]);

    setLayout({
      margin: { l: 0, r: 0, b: 0, t: 0 },
      scene: {
        xaxis: { range: [-1, 1] },
        yaxis: { range: [-1, 1] },
        zaxis: { range: [-1, 1] },
      },
    });
  }, [blochVector]);

  return <Plot data={data} layout={layout} style={{ width: "100%", height: "100%" }} />;
};

export default BlochSphere;
