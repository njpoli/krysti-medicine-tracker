export function localDay(value) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function historyPage(entries, filter = 'all', selectedDay = null) {
  const matching = entries.filter(e => filter === 'all' || e.medicine === filter)
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const days = [...new Set(matching.map(e => localDay(e.at)))].sort().reverse();
  const day = days.includes(selectedDay) ? selectedDay : (days.find(d => selectedDay && d < selectedDay) || days[0] || null);
  return { days, day, index: days.indexOf(day), entries: matching.filter(e => localDay(e.at) === day) };
}
