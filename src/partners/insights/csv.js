/**
 * The guest list as a CSV file, built in the browser from what is on screen.
 *
 * Starts with a UTF-8 byte-order mark: without it Excel opens the file as the
 * system code page and every Arabic name comes out as mojibake.
 */

export const BOM = '﻿'

const HEADERS = {
  en: ['Name', 'Phone', 'Bookings', 'Completed', 'Spent (SAR)', 'Last visit', 'Tags'],
  ar: ['الاسم', 'الجوال', 'الحجوزات', 'المكتملة', 'المصروف (ر.س)', 'آخر زيارة', 'الوسوم'],
}

/**
 * One cell. Quoted when it holds a comma, a quote or a line break. A cell that
 * starts with = + - @ would run as a formula in Excel, so it gets a leading
 * apostrophe — except an E.164 phone number, which is plain data.
 */
export function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text) && !/^\+\d{7,15}$/.test(text)) text = `'${text}`
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`
  return text
}

export function guestsToCsv(guests, lang = 'ar') {
  const header = HEADERS[lang === 'en' ? 'en' : 'ar']
  const rows = guests.map((g) => [
    g.name ?? '',
    g.phone ?? '',
    g.bookings ?? 0,
    g.completed ?? 0,
    Math.round(g.spent ?? 0),
    g.lastVisit ?? '',
    (g.tags ?? []).join('; '),
  ])
  return BOM + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

/** Hands the text to the browser as a file download. */
export function downloadCsv(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // Revoked on the next tick: some browsers start the download asynchronously.
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
