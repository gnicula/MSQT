import Link from 'next/link';
import { GradeRow } from '../data';

export function RightSection() {
  return <aside className="right-card">
    <div className="right-title">In this section</div>
    <Link className="link-row" href="/grades">Plan</Link>
    <div className="link-row" style={{display:'block'}}>Enroll
      <ul className="small-list">
        <li>My Class Schedule</li><li>Add</li><li>Drop</li><li>Swap</li><li>Edit</li><li>Term Information</li>
      </ul>
    </div>
    <Link className="link-row" href="/">My Academics</Link>
  </aside>;
}

export function GradeTable({ rows }: { rows: GradeRow[] }) {
  return <table aria-label="Class grades">
    <thead><tr><th>CLASS</th><th>DESCRIPTION</th><th>UNITS</th><th>GRADING</th><th>GRADE</th><th>GRADE POINTS</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.classCode}>
      <td className="bold"><a>{row.classCode}</a></td><td>{row.description}</td><td className="number">{row.units}</td><td>{row.grading}</td><td className="bold">{row.grade}</td><td className="number">{row.gradePoints}</td>
    </tr>)}</tbody>
  </table>;
}

export function TermStats({ spring = false }: { spring?: boolean }) {
  if (spring) return <table aria-label="Term statistics"><tbody>
    <tr><th>DESCRIPTION</th><th>FROM ENROLLMENT</th><th>CUMULATIVE TOTAL</th></tr>
    <tr className="dark-row"><td>Units Toward GPA:</td><td></td><td></td></tr>
    <tr><td>Taken</td><td className="number">9.000</td><td className="number">15.000</td></tr>
    <tr><td>Passed</td><td className="number">9.000</td><td className="number">15.000</td></tr>
    <tr className="dark-row"><td>Units Not for GPA:</td><td></td><td></td></tr>
    <tr><td>Taken</td><td className="number">2.000</td><td className="number">7.000</td></tr>
    <tr><td>Passed</td><td className="number">2.000</td><td className="number">4.000</td></tr>
    <tr className="dark-row"><td>GPA Calculation</td><td></td><td></td></tr>
    <tr><td className="bold">Total Grade Points</td><td className="number">30.000</td><td className="number">53.100</td></tr>
    <tr><td className="bold">/ &nbsp;Units Taken Toward GPA</td><td className="number">9.000</td><td className="number">15.000</td></tr>
    <tr><td className="bold">= GPA</td><td className="number bold">3.333</td><td className="number bold">3.540</td></tr>
  </tbody></table>;

  return <table aria-label="Term statistics"><tbody>
    <tr><th>DESCRIPTION</th><th>FROM ENROLLMENT</th><th>CUMULATIVE TOTAL</th></tr>
    <tr className="dark-row"><td>Units Toward GPA:</td><td></td><td></td></tr>
    <tr><td>Taken</td><td></td><td className="number">15.000</td></tr>
    <tr><td>Passed</td><td></td><td className="number">15.000</td></tr>
    <tr><td>In Progress</td><td className="number">9.000</td><td className="number">9.000</td></tr>
    <tr className="dark-row"><td>Units Not for GPA:</td><td></td><td></td></tr>
    <tr><td>Taken</td><td></td><td className="number">7.000</td></tr>
    <tr><td>Passed</td><td></td><td className="number">4.000</td></tr>
    <tr className="dark-row"><td>GPA Calculation</td><td></td><td></td></tr>
    <tr><td className="bold">Total Grade Points</td><td></td><td className="number">53.100</td></tr>
    <tr><td className="bold">/ &nbsp;Units Taken Toward GPA</td><td></td><td className="number">15.000</td></tr>
    <tr><td className="bold">= GPA</td><td></td><td className="number bold">3.540</td></tr>
  </tbody></table>;
}
