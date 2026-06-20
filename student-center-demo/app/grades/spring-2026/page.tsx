import Link from 'next/link';
import { AppLayout } from '../../components/Layout';
import { GradeTable, RightSection, TermStats } from '../../components/Common';
import { spring2026Grades } from '../../data';

export default function SpringGrades() {
  return <AppLayout>
    <div className="blue-title">View My Grades&nbsp; › &nbsp;Spring 2026 <Link href="/grades" style={{marginLeft:'auto', color:'#fff'}}>Change Term</Link></div>
    <div className="student-name">♟ Gabriele Nicula</div>
    <div className="center-layout">
      <section>
        <div className="panel"><div className="panel-title">⌃ &nbsp; Class Grades - Spring 2026</div><div className="panel-body"><div className="section-label">Official Grades</div><GradeTable rows={spring2026Grades}/></div></div>
        <div className="panel"><div className="panel-title">⌃ &nbsp; Term Statistics - Spring 2026</div><div className="panel-body"><TermStats spring/><p style={{marginTop:18}}><b>Academic Standing</b><span style={{marginLeft:180}}>Good Standing</span></p></div></div>
      </section>
      <RightSection />
    </div>
  </AppLayout>;
}
