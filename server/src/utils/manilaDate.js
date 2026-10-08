// Date helpers for "daily" features, fixed to Asia/Manila regardless of server TZ.

// Today as 'YYYY-MM-DD' in Asia/Manila (en-CA formats as YYYY-MM-DD).
const manilaToday = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// Calendar arithmetic on a 'YYYY-MM-DD' string (TZ-independent: treats it as a plain date).
const addDays = (dateStr, n) => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

module.exports = { manilaToday, addDays };
