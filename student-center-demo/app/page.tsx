import Link from 'next/link';
import { AppLayout } from './components/Layout';
import { RightSection } from './components/Common';
import { scheduleRows } from './data';

export default function Home() {
  return <AppLayout>
    <div className="blue-title">Gabriele&apos;s Student Center</div>
    <div className="indicators"><span className="indicator">✉ 1 Unread Messages</span><span className="indicator">▣ No Holds</span><span className="indicator">☷ No To Dos</span><span className="indicator">▤ 1 Other Indicators</span></div>
    <div className="dashboard-grid">
      <section>
        <button className="search-class">Search for Classes</button>
        <div className="panel">
          <div className="panel-title">Academics</div>
          <div className="panel-body actions-grid">
            <div className="panel account-summary">
              <div className="panel-title">Fall 2026 Schedule</div>
              <div className="panel-body">
                <table><thead><tr><th>CLASS</th><th>SCHEDULE</th></tr></thead><tbody>{scheduleRows.map(r => <tr key={r.classCode}><td style={{whiteSpace:'pre-line'}}>{r.classCode}</td><td style={{whiteSpace:'pre-line'}}>{r.schedule}</td></tr>)}</tbody></table>
                <Link className="indicator" style={{display:'inline-flex', marginTop: 16}} href="/grades">▦ Enrollment Shopping Cart</Link>
              </div>
            </div>
            <div className="right-card">
              {['Search','CSU Fully Online','Plan','Enroll','MyProgress','My Academics','MyScheduler','Order Official Transcript'].map(item => <Link className="link-row" key={item} href={item === 'My Academics' ? '/grades' : '/'}>{item}<span>›</span></Link>)}
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-title">Finances</div>
          <div className="panel-body actions-grid">
            <div className="panel account-summary"><div className="panel-title">Account Summary (See * link below)</div><div className="panel-body"><ul><li><b>Due Now</b> 0.00</li><li><b>Future Due</b> 5,633.50</li></ul><p><b>You owe 5,633.50.</b><br/>View Due Date</p></div></div>
            <div className="right-card"><div className="right-title">Financial Aid</div><Link className="link-row" href="/">View Financial Aid<span>›</span></Link><Link className="link-row" href="/">Accept/Decline Awards<span>›</span></Link></div>
          </div>
        </div>
      </section>
      <section><RightSection /><div className="right-card"><div className="right-title">Enrollment Dates</div><div className="panel-body"><b>Enrollment<br/>Appointment</b><p>You may begin enrolling for Summer 2026 Session Two on April 8, 2026.</p></div></div></section>
    </div>
  </AppLayout>;
}
