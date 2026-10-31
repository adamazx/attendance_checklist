/**
 * Unit tests for parseRoster — run with `pnpm test`.
 *
 * Guards the 🔴-1 fix: long numeric student IDs from Excel must NOT be mangled
 * into scientific notation, and text IDs with leading zeros must survive.
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import * as XLSX from 'xlsx'

import { parseRoster } from './parseRoster.ts'

/** Build a one-worksheet .xlsx from an array-of-arrays and return its bytes. */
const makeXlsx = (rows: unknown[][]): ArrayBuffer => {
  const ws = XLSX.utils.aoa_to_sheet(rows)
  // Force the two ID cells to specific types: A2 numeric, A3 text.
  ws['A2'] = { t: 'n', v: 1234567890123 } // 13-digit numeric id
  ws['A3'] = { t: 's', v: '01023' } // leading-zero text id
  ws['!ref'] = 'A1:B3'
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  return out
}

test('xlsx: 13-digit numeric studentId survives (no scientific notation)', () => {
  const bytes = makeXlsx([
    ['เลขประจำตัว', 'ชื่อ'],
    [0, 'สมชาย'], // overwritten to numeric 1234567890123 by makeXlsx
    [0, 'สมหญิง'], // overwritten to text '01023'
  ])
  const grid = parseRoster('roster.xlsx', bytes)
  assert.equal(grid[1][0], '1234567890123', 'numeric id must not be formatted to exponent')
  assert.equal(grid[2][0], '01023', 'leading-zero text id must be preserved')
})

test('xlsx: 5-digit numeric id stays a plain integer string', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['เลขประจำตัว', 'ชื่อ'],
    [10001, 'ก'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'S')
  const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
  const grid = parseRoster('r.xlsx', bytes)
  assert.equal(grid[1][0], '10001')
})

test('csv: UTF-8 BOM stripped and quoted field with comma parsed', () => {
  const csv = '﻿เลขประจำตัว,ชื่อ\r\n"10001","ใจ, ดี"\r\n'
  const bytes = new TextEncoder().encode(csv).buffer
  const grid = parseRoster('roster.csv', bytes)
  assert.equal(grid[0][0], 'เลขประจำตัว', 'BOM must be stripped from first header')
  assert.equal(grid[1][0], '10001')
  assert.equal(grid[1][1], 'ใจ, ดี', 'quoted comma must stay in one field')
})
