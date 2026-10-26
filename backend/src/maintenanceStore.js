const fs = require('node:fs')
const path = require('node:path')
const { randomUUID } = require('node:crypto')
const DATA_FILE = path.join(__dirname, '..', 'data', 'maintenance.json')

function readTasks() {
  try {
    const tasks = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    if (!Array.isArray(tasks)) throw new Error('Maintenance data must be a list')
    return tasks
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw error
  }
}

function writeTasks(tasks) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true })
  const temporaryPath = `${DATA_FILE}.${process.pid}.tmp`
  fs.writeFileSync(temporaryPath, JSON.stringify(tasks, null, 2), 'utf8')
  fs.renameSync(temporaryPath, DATA_FILE)
  return tasks
}

function validateTask(input, current = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Maintenance task must be an object')
  const title = input.title ?? current.title
  const assignedDate = input.assignedDate ?? current.assignedDate
  const priority = input.priority ?? current.priority ?? 'Medium'
  const status = input.status ?? current.status ?? 'Pending'
  const assetId = input.assetId ?? current.assetId ?? null
  if (typeof title !== 'string' || !title.trim() || title.trim().length > 160) throw new Error('Task title must be 1-160 characters')
  if (typeof assignedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(assignedDate)) {
    throw new Error('Task date must use YYYY-MM-DD')
  }
  const parsedDate = new Date(`${assignedDate}T00:00:00Z`)
  if (!Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== assignedDate) {
    throw new Error('Task date must use YYYY-MM-DD')
  }
  if (!['Low', 'Medium', 'High'].includes(priority)) throw new Error('Priority must be Low, Medium, or High')
  if (!['Pending', 'In Progress', 'Completed'].includes(status)) throw new Error('Invalid maintenance status')
  if (assetId !== null && (typeof assetId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(assetId))) {
    throw new Error('Invalid maintenance asset id')
  }
  return {
    id: current.id || input.id || randomUUID(),
    title: title.trim(),
    assignedDate,
    assetId,
    priority,
    status,
    updatedAt: Date.now(),
  }
}

function listTasks() {
  return readTasks()
}

function createTask(input) {
  const tasks = readTasks()
  const task = validateTask(input)
  if (tasks.some((item) => item.id === task.id)) throw new Error('Maintenance task id already exists')
  tasks.push(task)
  return writeTasks(tasks)
}

function updateTask(id, input) {
  const tasks = readTasks()
  const index = tasks.findIndex((task) => task.id === id)
  if (index === -1) throw Object.assign(new Error('Maintenance task not found'), { statusCode: 404 })
  tasks[index] = validateTask(input, tasks[index])
  return writeTasks(tasks)
}

function removeTask(id) {
  const tasks = readTasks()
  const filtered = tasks.filter((task) => task.id !== id)
  if (filtered.length === tasks.length) throw Object.assign(new Error('Maintenance task not found'), { statusCode: 404 })
  return writeTasks(filtered)
}

module.exports = { listTasks, createTask, updateTask, removeTask }
