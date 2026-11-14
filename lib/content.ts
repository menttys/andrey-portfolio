// Everything the page says, in one place. The markup in components/ only lays it out.

export const GH_USER = 'menttys';
export const EMAIL = { user: 'furlany@', domain: 'gmail.com' };

export const HEADLINE = 'Engineering interfaces with a designer’s eye.';

export const INTRO =
  'Senior software engineer specialised in front-end and mobile, from React Native apps to the web. I lead app architecture and migrations, mentor teams, and still sweat the pixels from my years in graphic and type design.';

export const WORK = [
  { num: '01', color: '#C8552F', name: 'EvEnergy', text: 'Led the mobile app restructure and Expo migration, and built one shared component library for web and mobile.', role: 'Front-end + mobile', year: '2024 — 26' },
  { num: '02', color: '#8C9F33', name: 'Unibuddy', text: 'Performance work on an instant chat app that helped it reach 1M users.', role: 'Mobile', year: '2022 — 24' },
  { num: '03', color: '#2A2D38', name: 'TotallyMoney', text: 'Merged several projects into one Gatsby site and several signup journeys into one flow, on web and native.', role: 'Front-end + mobile', year: '2019 — 21' },
  { num: '04', color: '#B4C233', name: 'Pollen', text: 'Redesigned an internal box-office app and took an event admissions scanner from MVP to v1, later merged into one app with several data sources.', role: 'Mobile', year: '2021 — 22' },
];

export const JOBS: { dates: string; name: string; text: string; kind: string; quiet?: boolean }[] = [
  { dates: '08/2024 — 05/2026', name: 'EvEnergy', text: 'Mobile app restructure and Expo migration, a shared web and mobile component library, architecture and performance standards.', kind: 'Front-end / Mobile' },
  { dates: '03/2024 — 06/2024', name: 'TreeCard', text: 'Contract work on an email client in React Native, focused on performance and a clean, responsive experience.', kind: 'Mobile · Contract' },
  { dates: '09/2022 — 02/2024', name: 'Unibuddy', text: 'Instant chat app scaled to 1M users. Code reviews, refactoring, new features and team coding standards.', kind: 'Mobile' },
  { dates: '09/2021 — 08/2022', name: 'Pollen', text: 'Redesigned an internal box-office app and took an event admissions scanner from MVP to v1.', kind: 'Mobile' },
  { dates: '06/2019 — 08/2021', name: 'TotallyMoney', text: 'Led the GatsbyJS move to a single static site and unified signup journeys across web and native.', kind: 'Front-end / Mobile' },
  { dates: '10/2018 — 05/2019', name: 'Trik', text: 'UI for a web platform that renders drone imagery as interactive 3D maps.', kind: 'Front-end' },
  { dates: '03/2018 — 10/2018', name: 'BrilliantMedia', text: 'User-facing interface and features for the Cake Monster platform.', kind: 'Front-end' },
  { dates: '07/2017 — 11/2017', name: 'Freelance web developer', text: 'Web projects for independent clients, including a small process-automation app: my first React project, and the one that brought me back to development for good.', kind: 'Freelance' },
  { dates: '01/2011 — 08/2017', name: 'Craft years', text: 'Time away from code, dedicated to craft and curiosity: graphic design, type design, calligraphy and travel.', kind: 'Design', quiet: true },
  { dates: '01/2009 — 10/2010', name: 'Forza', text: 'Web developer and graphic designer in Brazil, building and designing sites end to end.', kind: 'Web dev / Design' },
  { dates: '02/2008 — 10/2008', name: 'Centro Universitário CEUNSP', text: 'Graphic designer at the university where I studied Web Development & Multimedia Design.', kind: 'Graphic design' },
  { dates: '03/2008 — 09/2008', name: 'Four Publicidade', text: 'Web developer at an advertising agency in Brazil.', kind: 'Web dev' },
  { dates: '05/2006 — 08/2008', name: 'Cúria Diocesana de Jundiaí', text: 'Looked after the websites and online services for the cities of the Diocese. My first web role.', kind: 'Web dev' },
];

export const SKILLS = [
  { num: '01', name: 'Engineering', text: 'React Native, React, Expo, JavaScript, HTML/CSS, Redux, GraphQL, Jest, Next.js, Three.js, PHP, Python' },
  { num: '02', name: 'Design', text: 'Design systems, UI design, graphic design, type design. Postgraduate in Graphic Design, SENAC; Web Development & Multimedia Design, CEUNSP' },
  { num: '03', name: 'Cloud & AI', text: 'AWS and serverless, LLM integration, AI agents, AI coding tools. AWS Developer Associate, AWS Cloud Practitioner' },
  { num: '04', name: 'Languages', text: 'Portuguese (native), English (proficient), Italian and Spanish (conversational). Brazilian, Italian and British' },
];
