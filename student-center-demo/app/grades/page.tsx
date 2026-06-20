import Link from 'next/link';
import { AppLayout } from '../components/Layout';
import { RightSection } from '../components/Common';

export default function GradesIndex() {
  return <AppLayout>
    <div className="blue-title">View My Grades</div>
    <div className="student-name">♟ Gabriele Nicula</div>
    <div className="center-layout">
      <section>
        <button className="sort-button">↕ Sort By</button>
        <div className="term-list">
          <Link href="/grades/fall-2026" className="term-row"><span><div className="term-name">Fall 2026</div><div className="term-sub">Graduate<br/>San Jose State University</div></span><span className="chev">›</span></Link>
          <Link href="/grades/spring-2026" className="term-row"><span><div className="term-name">Spring 2026</div><div className="term-sub">Graduate<br/>San Jose State University</div></span><span className="chev">›</span></Link>
          <Link href="/grades" className="term-row"><span><div className="term-name">Fall 2025</div><div className="term-sub">Graduate<br/>San Jose State University</div></span><span className="chev">›</span></Link>
        </div>
      </section>
      <RightSection />
    </div>
  </AppLayout>;
}
