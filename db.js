// Lightweight file-based database (no native modules, fully portable).
// Data lives in data/db.json and is read/written synchronously.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'data', 'db.json');

const DEPARTMENTS = [
  { code: 'CIVIL', name: 'Civil Engineering' },
  { code: 'MECH', name: 'Mechanical Engineering' },
  { code: 'ECE', name: 'Electronics & Communication Engineering' },
  { code: 'EEE', name: 'Electrical & Electronics Engineering' },
  { code: 'AERO', name: 'Aeronautical Engineering' },
  { code: 'CSE', name: 'Computer Science Engineering' },
  { code: 'AIML', name: 'AI & Machine Learning' }
];

// Realistic subjects for the first 3 semesters of each department.
// Semesters 4-8 are seeded empty so teachers/admins can populate them
// from the Admin panel (this keeps the full 7 x 8 structure real and usable).
const SEM_1_COMMON = ['Engineering Mathematics I', 'Engineering Physics', 'Engineering Chemistry', 'Basic Electrical & Electronics', 'Engineering Graphics', 'Communicative English'];

const DEPT_SUBJECTS = {
  CIVIL: {
    2: ['Engineering Mathematics II', 'Mechanics of Solids', 'Surveying I', 'Building Materials & Construction', 'Fluid Mechanics'],
    3: ['Concrete Technology', 'Surveying II', 'Structural Analysis I', 'Geotechnical Engineering I', 'Hydraulics']
  },
  MECH: {
    2: ['Engineering Mathematics II', 'Engineering Mechanics', 'Thermodynamics', 'Material Science', 'Manufacturing Processes'],
    3: ['Fluid Mechanics & Machinery', 'Strength of Materials', 'Kinematics of Machines', 'Metrology & Measurements', 'Production Technology']
  },
  ECE: {
    2: ['Engineering Mathematics II', 'Electronic Devices & Circuits', 'Digital Logic Design', 'Network Theory', 'Signals & Systems'],
    3: ['Analog Communication', 'Electromagnetic Theory', 'Microprocessors & Microcontrollers', 'Linear IC Applications', 'Control Systems']
  },
  EEE: {
    2: ['Engineering Mathematics II', 'Electrical Circuit Analysis', 'Electromagnetic Fields', 'Digital Electronics', 'Electrical Machines I'],
    3: ['Electrical Machines II', 'Power Systems I', 'Control Systems', 'Analog Electronics', 'Measurements & Instrumentation']
  },
  AERO: {
    2: ['Engineering Mathematics II', 'Fluid Mechanics', 'Aircraft Materials & Structures', 'Thermodynamics', 'Mechanics of Machines'],
    3: ['Aerodynamics I', 'Aircraft Structures I', 'Propulsion I', 'Flight Mechanics', 'Aircraft Systems']
  },
  CSE: {
    2: ['Engineering Mathematics II', 'Data Structures', 'Object Oriented Programming', 'Digital Logic Design', 'Discrete Mathematics'],
    3: ['Database Management Systems', 'Operating Systems', 'Design & Analysis of Algorithms', 'Computer Organization', 'Java Programming']
  },
  AIML: {
    2: ['Engineering Mathematics II', 'Python for Data Science', 'Data Structures', 'Probability & Statistics', 'Digital Logic Design'],
    3: ['Machine Learning Fundamentals', 'Database Management Systems', 'Design & Analysis of Algorithms', 'Linear Algebra for AI', 'Operating Systems']
  }
};

function freshId(prefix) {
  return prefix + '_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function buildSeed() {
  const departments = [];
  const semesters = [];
  const subjects = [];

  DEPARTMENTS.forEach(dept => {
    const deptId = freshId('dept');
    departments.push({ id: deptId, code: dept.code, name: dept.name });

    for (let s = 1; s <= 8; s++) {
      const semId = freshId('sem');
      semesters.push({ id: semId, departmentId: deptId, number: s });

      let subjectNames = [];
      if (s === 1) subjectNames = SEM_1_COMMON;
      else if (DEPT_SUBJECTS[dept.code] && DEPT_SUBJECTS[dept.code][s]) subjectNames = DEPT_SUBJECTS[dept.code][s];

      subjectNames.forEach(name => {
        subjects.push({
          id: freshId('subj'),
          semesterId: semId,
          name,
          details: '',
          notes: [],
          pyqs: [],
          classLink: ''
        });
      });
    }
  });

  const users = [
    {
      id: freshId('user'),
      name: 'Admin User',
      email: 'admin@campus.edu',
      passwordHash: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      departmentId: null,
      semesterNumber: null,
      phone: '+91 98765 43210',
      office: 'Administration Block, Room 101',
      profilePicture: null
    },
    {
      id: freshId('user'),
      name: 'Prof. Anita Rao',
      email: 'teacher@campus.edu',
      passwordHash: bcrypt.hashSync('teacher123', 10),
      role: 'teacher',
      departmentId: departments.find(d => d.code === 'CSE').id,
      semesterNumber: null,
      teaches: 'Data Structures, DBMS (CSE Sem 3)',
      phone: '',
      office: '',
      profilePicture: null
    },
    {
      id: freshId('user'),
      name: 'Rahul Menon',
      email: 'student@campus.edu',
      passwordHash: bcrypt.hashSync('student123', 10),
      role: 'student',
      departmentId: departments.find(d => d.code === 'CSE').id,
      semesterNumber: 3,
      phone: '',
      office: '',
      profilePicture: null
    }
  ];

  return {
    departments,
    semesters,
    subjects,
    users,
    attendance: [],   // { id, subjectId, studentId, date, status }
    performance: [],  // { id, studentId, subjectId, examType, marks, maxMarks }
    culturals: [],    // { id, studentId, title, description, date, addedBy }
    events: [],       // { id, title, date, description, departmentId|null }
    remarks: [],      // { id, studentId, teacherId, text, date }
    guidelines: [      // college info / guidelines, editable by admin
      { id: freshId('gd'), title: 'Attendance Policy', body: 'A minimum of 75% attendance is required in every subject to be eligible to sit for semester exams.' },
      { id: freshId('gd'), title: 'Code of Conduct', body: 'Students are expected to maintain discipline, punctuality, and respect towards faculty and peers on campus.' },
      { id: freshId('gd'), title: 'Examination Guidelines', body: 'Carry your ID card to every exam. Electronic devices are not permitted inside the examination hall.' }
    ]
  };
}

function ensureDb() {
  if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(buildSeed(), null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readDb, writeDb, freshId, ensureDb };
