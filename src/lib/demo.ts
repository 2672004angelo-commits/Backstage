export const demoShows = [
  {
    _id: "67d2a1000000000000000001",
    title: "ليلة في فيينا",
    description: "عرض مسرحية غنائي مستوحى من أجواء القاعات الكلاسيكية، يجمع الموسيقى والحكاية وإضاءة سينمائية فائقة.",
    date: "2026-12-18",
    time: "20:30",
    venue: "المسرح الوطني المصري",
    price: 45000,
    capacity: 180,
    open: true,
  },
  {
    _id: "67d2a1000000000000000002",
    title: "قمر الزقاق",
    description: "دراما عربية معاصرة عن الحكايات التي تجمع الحي القديم وذكريات ثلاثة أجيال.",
    date: "2026-12-25",
    time: "19:00",
    venue: "قاعة رشيد",
    price: 35000,
    capacity: 240,
    open: true,
  },
  {
    _id: "67d2a1000000000000000003",
    title: "الستار الأخير",
    description: "عمل تشويقي يمزج الفن المسرحي بالأداء الحي والمفاجآت في ليلة افتتاحية استثنائية.",
    date: "2027-01-02",
    time: "21:00",
    venue: "مسرح الرشيد",
    price: 60000,
    capacity: 150,
    open: true,
  },
];

export const demoBookings = [
  { id: "BS-10284", fullName: "نور سامي", mobile: "01012345678", quantity: 2, totalAmount: 90000, status: "PENDING_REVIEW", show: "ليلة في فيينا" },
  { id: "BS-10283", fullName: "عمر خالد", mobile: "07809876543", quantity: 4, totalAmount: 140000, status: "APPROVED", show: "قمر الزقاق" },
  { id: "BS-10282", fullName: "لينا أحمد", mobile: "07501112233", quantity: 1, totalAmount: 60000, status: "APPROVED", show: "الستار الأخير" },
  { id: "BS-10281", fullName: "حسن علي", mobile: "01155556677", quantity: 3, totalAmount: 105000, status: "REJECTED", show: "قمر الزقاق" },
];
