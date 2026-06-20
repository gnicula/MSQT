export type GradeRow = {
  classCode: string;
  description: string;
  units: string;
  grading: string;
  grade: string;
  gradePoints: string;
};

export const spring2026Grades: GradeRow[] = [
  { classCode: 'PHYS 250', description: 'Quantum Programming', units: '3.00', grading: 'Letter Graded', grade: 'A', gradePoints: '12.000' },
  { classCode: 'PHYS 255', description: 'Advanced Physics', units: '3.00', grading: 'Letter Graded', grade: 'A', gradePoints: '12.000' },
  { classCode: 'PHYS 263A', description: 'Quantum Theory I', units: '3.00', grading: 'Letter Graded', grade: 'C', gradePoints: '6.000' },
  { classCode: 'PHYS 297', description: 'Directed Research', units: '2.00', grading: 'CR/NC/RP', grade: 'CR', gradePoints: '' }
];

export const fall2026Grades: GradeRow[] = [
  { classCode: 'EE 225', description: 'Intro Quantum Comp', units: '3.00', grading: 'Letter Graded', grade: '', gradePoints: '' },
  { classCode: 'EE 276', description: 'Quantum Error Correc', units: '3.00', grading: 'Letter Graded', grade: '', gradePoints: '' },
  { classCode: 'PHYS 253', description: 'Quant Many-Body Phys', units: '3.00', grading: 'Letter Graded', grade: '', gradePoints: '' }
];

export const scheduleRows = [
  { classCode: 'EE 225-01\nLEC (43930)', schedule: 'TuTh 7:30PM - 8:45PM\nEngineering Building 343' },
  { classCode: 'EE 276-01\nSEM (48124)', schedule: 'TuTh 6:00PM - 7:15PM\nEngineering Building 403' },
  { classCode: 'PHYS 253-01\nLEC (48648)', schedule: 'TuTh 3:00PM - 4:15PM\nDuncan Hall 219' }
];
