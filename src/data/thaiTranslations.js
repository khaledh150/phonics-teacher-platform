export const THAI_SOUND_NAMES = {
  s: 'ซ', a: 'แอ', t: 'ท', i: 'อิ', p: 'พ', n: 'น',
  c: 'ค', k: 'ค', e: 'เอ', h: 'ฮ', r: 'ร', m: 'ม', d: 'ด',
  g: 'ก', o: 'ออ', u: 'อะ', l: 'ล', f: 'ฟ', b: 'บ',
  ai: 'เอ-ไอ', ay: 'เอ-วาย', 'a-e': 'เอ-อี', j: 'จ',
  oa: 'โอ-เอ', ow: 'โอ-ดับเบิลยู', 'o-e': 'โอ-อี',
  ie: 'ไอ-อี', y: 'วาย', igh: 'ไอ-จี-เอช', 'i-e': 'ไอ-อี',
  ee: 'อี-อี', ea: 'อี-เอ', 'e-e': 'อี-อี',
  or: 'ออ-ร', al: 'แอ-แอล', au: 'เอ-ยู', aw: 'เอ-ดับเบิลยู',
  z: 'ซ', w: 'ว', ng: 'ง',
  oo: 'อู', ooo: 'อู(ยาว)',
  v: 'ว', x: 'เอ็กซ์',
  ch: 'ช', sh: 'ช(เบา)',
  th: 'ธ', thh: 'ธ(หนัก)',
  qu: 'คว',
  ou: 'เอา', oi: 'ออย', oy: 'ออย',
  ue: 'ยู-อี', ew: 'อิว', 'u-e': 'ยู-อี',
  er: 'เออร์', ir: 'เออร์', ur: 'เออร์',
  ar: 'อาร์',
};

const THAI_TRANSLATIONS = {
  // Group 1
  sat: 'นั่ง', pan: 'กระทะ', pin: 'เข็มหมุด', sip: 'จิบ', nap: 'งีบหลับ',
  tan: 'สีน้ำตาล', tin: 'กระป๋อง', pit: 'หลุม', sap: 'ยางไม้', ant: 'มด',
  // Group 2
  pen: 'ปากกา', man: 'ผู้ชาย', hen: 'แม่ไก่', cap: 'หมวก', map: 'แผนที่',
  pet: 'สัตว์เลี้ยง', mad: 'โกรธ', kit: 'ชุดอุปกรณ์', ham: 'แฮม', cam: 'กล้อง', red: 'สีแดง',
  // Group 3
  dog: 'สุนัข', sun: 'ดวงอาทิตย์', bug: 'แมลง', hot: 'ร้อน', fat: 'อ้วน',
  lip: 'ริมฝีปาก', lit: 'จุด(ไฟ)', tag: 'ป้าย', led: 'นำ', ban: 'ห้าม',
  // Group 4
  rain: 'ฝน', nail: 'ตะปู', tail: 'หาง', cake: 'เค้ก', bake: 'อบ',
  lake: 'ทะเลสาบ', hay: 'หญ้าแห้ง', pay: 'จ่าย', say: 'พูด', fail: 'ล้มเหลว',
  // Group 5
  jam: 'แยม', jet: 'เครื่องบินไอพ่น', jug: 'เหยือก', jab: 'ฉีดยา', jig: 'เต้นรำ',
  jot: 'จดบันทึก', jay: 'นกเจย์', jail: 'คุก', job: 'งาน', jade: 'หยก',
  // Group 6
  goat: 'แพะ', boat: 'เรือ', soap: 'สบู่', cone: 'กรวย', bone: 'กระดูก',
  home: 'บ้าน', bowl: 'ชาม', mow: 'ตัดหญ้า', low: 'ต่ำ', rope: 'เชือก',
  // Group 7
  tie: 'ผูก', pie: 'พาย', die: 'ตาย', sky: 'ท้องฟ้า', cry: 'ร้องไห้',
  bike: 'จักรยาน', high: 'สูง', light: 'แสง', ride: 'ขี่', right: 'ถูกต้อง',
  // Group 8
  feet: 'เท้า', beef: 'เนื้อวัว', heel: 'ส้นเท้า', eat: 'กิน', seat: 'ที่นั่ง',
  sea: 'ทะเล', seed: 'เมล็ด', gene: 'ยีน', delete: 'ลบ', theme: 'ธีม',
  // Group 9
  fork: 'ส้อม', form: 'แบบฟอร์ม', corn: 'ข้าวโพด', jaw: 'ขากรรไกร', law: 'กฎหมาย',
  ball: 'ลูกบอล', wall: 'กำแพง', call: 'เรียก', fault: 'ความผิด', Paul: 'พอล',
  // Group 10
  zip: 'ซิป', wag: 'กระดิก', king: 'กษัตริย์', zap: 'แปลบ', wig: 'วิก',
  long: 'ยาว', ring: 'แหวน', bang: 'เสียงดัง', wet: 'เปียก', buzz: 'หึ่ง',
  // Group 11
  book: 'หนังสือ', wood: 'ไม้', food: 'อาหาร', moon: 'ดวงจันทร์', zoo: 'สวนสัตว์',
  root: 'ราก', cook: 'ทำอาหาร', hook: 'ตะขอ', foot: 'เท้า', roof: 'หลังคา',
  // Group 12
  vet: 'สัตวแพทย์', van: 'รถตู้', vex: 'รบกวน', yam: 'มันเทศ', yap: 'เห่า',
  yes: 'ใช่', six: 'หก', fix: 'ซ่อม', mix: 'ผสม', box: 'กล่อง',
  // Group 13
  chip: 'มันฝรั่งทอด', chat: 'พูดคุย', chop: 'สับ', chin: 'คาง', cash: 'เงินสด',
  ship: 'เรือ', shop: 'ร้านค้า', shin: 'หน้าแข้ง', shot: 'การยิง', rash: 'ผื่น', lash: 'ขนตา',
  // Group 14
  thick: 'หนา', three: 'สาม', this: 'นี่', that: 'นั่น', thin: 'บาง',
  them: 'พวกเขา', then: 'แล้ว', with: 'กับ', bath: 'อาบน้ำ', math: 'คณิตศาสตร์',
  moth: 'ผีเสื้อกลางคืน', these: 'เหล่านี้', things: 'สิ่งของ',
  // Group 15
  quiz: 'แบบทดสอบ', quiet: 'เงียบ', quilt: 'ผ้านวม', quill: 'ปากกาขนนก', quit: 'เลิก',
  quest: 'การเดินทาง', queen: 'ราชินี', quick: 'เร็ว', quack: 'ก๊าบ', Quin: 'ควิน',
  // Group 16
  owl: 'นกฮูก', fowl: 'สัตว์ปีก', down: 'ลง', town: 'เมือง', cow: 'วัว',
  cloud: 'เมฆ', loud: 'ดัง', count: 'นับ', round: 'กลม', house: 'บ้าน',
  couch: 'โซฟา', howl: 'หอน', mouth: 'ปาก', out: 'ออก', pouch: 'กระเป๋า', south: 'ใต้',
  // Group 17
  oil: 'น้ำมัน', coin: 'เหรียญ', boil: 'ต้ม', soil: 'ดิน', foil: 'ฟอยล์',
  boy: 'เด็กผู้ชาย', joy: 'ความสุข', toy: 'ของเล่น', royal: 'ราชวงศ์', loyal: 'ซื่อสัตย์',
  // Group 18
  clue: 'เบาะแส', glue: 'กาว', blue: 'สีน้ำเงิน', true: 'จริง', drew: 'วาด',
  flew: 'บิน', blew: 'พัด', rude: 'หยาบคาย', June: 'มิถุนายน', rule: 'กฎ',
  // Group 19
  river: 'แม่น้ำ', fern: 'เฟิร์น', serve: 'เสิร์ฟ', bird: 'นก', girl: 'เด็กผู้หญิง',
  sir: 'ท่าน', dirt: 'ดิน', curl: 'ลอน', fur: 'ขน', curve: 'โค้ง',
  chirp: 'เจี๊ยบ', herd: 'ฝูง', hurt: 'เจ็บ', perm: 'ดัดผม', shirt: 'เสื้อ',
  turf: 'สนามหญ้า', turn: 'เลี้ยว',
  // Group 20
  arm: 'แขน', bar: 'แท่ง', art: 'ศิลปะ', jar: 'โถ', car: 'รถยนต์',
  ark: 'เรือ', dark: 'มืด', bark: 'เห่า', card: 'การ์ด', park: 'สวน',
  far: 'ไกล', mark: 'คะแนน', shark: 'ฉลาม', tar: 'ยางมะตอย',
};

export default THAI_TRANSLATIONS;
