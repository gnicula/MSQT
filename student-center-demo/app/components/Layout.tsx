import Link from 'next/link';
import '../globals.css';

const nav = [
  ['★', 'Faculty Center', '/'],
  ['★', 'Student Center', '/'],
  ['✉', 'View My Messages', '/'],
  ['▣', 'Holds', '/'],
  ['☷', 'To Do List', '/'],
  ['▭', 'Make a Payment', '/'],
  ['▤', 'Academics: Enrollment', '/'],
  ['▰', 'Academics: Records', '/grades'],
  ['$', 'Finances', '/'],
  ['▣', 'Admissions', '/'],
  ['♟', 'Personal Information', '/'],
  ['!', 'Alert-SJSU', '/'],
  ['▰', 'Other Items', '/']
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="logo"><span>SJSU</span><small>SAN JOSE STATE<br />UNIVERSITY</small></div>
        <div className="top-icons"><Link className="top-icon" href="/">⌂</Link><span className="top-icon">◉</span><span className="top-icon logout">↻</span></div>
      </header>
      <div className="app-shell">
        <aside className="sidebar">
          {nav.map(([icon, label, href]) => (
            <Link key={label} className={`nav-item ${label === 'Academics: Records' ? 'active' : ''}`} href={href}>
              <span className="nav-icon">{icon}</span><span>{label}</span><span className="chev">›</span>
            </Link>
          ))}
          <Link className="nav-item red" href="/"><span className="nav-icon">↻</span><span>Logout</span><span className="chev">›</span></Link>
        </aside>
        <main className="main">
          <div className="demo-watermark">UNOFFICIAL DEMO</div>
          <div className="content">{children}</div>
          <div className="demo-ribbon">UNOFFICIAL DEMO - NOT AN ACADEMIC RECORD</div>
        </main>
      </div>
    </>
  );
}
