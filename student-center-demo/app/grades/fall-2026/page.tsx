import Link from 'next/link';
import { AppLayout } from '../../components/Layout';
import { GradeTable, RightSection, TermStats } from '../../components/Common';
import { fall2026Grades } from '../../data';

export default function FallGrades() {
  return <AppLayout>
    <div className="blue-title">View My Grades&nbsp; › &nbsp;Fall 2026 <Link href="/grades" style={{marginLeft:'auto', color:'#fff'}}>Change Term</Link></div>
    <div className="student-name">♟ Gabriele Nicula</div>
    <div className="center-layout">
      <section>
        <div className="panel"><div className="panel-title">⌃ &nbsp; Class Grades - Fall 2026</div><div className="panel-body"><div className="section-label">Official Grades</div><GradeTable rows={fall2026Grades}/></div></div>
        <div className="panel"><div className="panel-title">⌃ &nbsp; Term Statistics - Fall 2026</div><div className="panel-body"><TermStats /></div></div>
      </section>
      <RightSection />
    </div>
  </AppLayout>;
}
