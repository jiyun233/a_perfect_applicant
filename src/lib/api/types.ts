export type MachineState = 'idle' | 'playing' | 'offline'
export type ReservationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'expired'
export type CellState = 'available' | 'limited' | 'full' | 'past'

export interface MachineStatus {
  state: MachineState
  currentPlayers: number
  currentSong: string
  currentChart: string
  note: string
  lastSeenAt: string
  updatedAt: string
}

export interface Machine {
  id: string
  code: string
  name: string
  game: string
  cabinetModel: string
  softwareVersion: string
  location: string
  capacity: number
  sortOrder: number
  active: boolean
  notes: string
  status: MachineStatus
  createdAt: string
  updatedAt: string
}

export interface MachinesResponse {
  machines: Machine[]
  serverTime: string
}

export interface Slot {
  startTime: string
  endTime: string
}

export interface ScheduleCell {
  machineId: string
  slotStart: string
  slotEnd: string
  approvedPeople: number
  pendingPeople: number
  capacity: number
  state: CellState
}

export interface PublicReservationEntry {
  machineId: string
  startTime: string
  endTime: string
  partySize: number
  nickname: string
  status: ReservationStatus
}

export interface Schedule {
  date: string
  today: string
  maxDate: string
  timezone: string
  openTime: string
  closeTime: string
  slotMinutes: number
  bookingDays: number
  maxSlots: number
  serverTime: string
  machines: Machine[]
  slots: Slot[]
  cells: ScheduleCell[]
  reservations: PublicReservationEntry[]
}

export interface ReservationMachine {
  id: string
  code: string
  name: string
  game: string
  softwareVersion: string
  location: string
}

export interface Reservation {
  id: string
  code?: string
  machine: ReservationMachine
  date: string
  startTime: string
  endTime: string
  startAt: string
  endAt: string
  partySize: number
  nickname: string
  studentId?: string
  applicantName?: string
  majorClass?: string
  email?: string
  note: string
  status: ReservationStatus
  statusLabel: string
  rejectionReason: string
  createdAt: string
  canCancel: boolean
  emailStatus?: EmailStatus
}

export interface CreateReservationInput {
  machineId: string
  date: string
  startTime: string
  endTime: string
  partySize: number
  studentId: string
  applicantName: string
  majorClass: string
  nickname: string
  email: string
  note: string
}

export interface CreateReservationResponse {
  reservation: Reservation
  code: string
  emailQueued: boolean
}

export interface AdminProfile {
  id: string
  email: string
  displayName: string
  lastLoginAt?: string
}

export interface AdminLoginResponse {
  token: string
  expiresAt: string
  admin: AdminProfile
}

export interface DashboardStats {
  pendingReservations: number
  todayReservations: number
  totalMachines: number
  onlineMachines: number
  playingMachines: number
  pendingEmails: number
  failedEmails: number
}

export interface AdminDashboard {
  stats: DashboardStats
  pending: Reservation[]
  mailDriver: string
  serverTime: string
  pendingCount: number
  application: string
}

export interface MachineInput {
  code: string
  name: string
  game: string
  cabinetModel: string
  softwareVersion: string
  location: string
  capacity: number
  sortOrder: number
  active: boolean
  notes: string
}

export interface MachineStatusInput {
  state: MachineState
  currentPlayers: number
  currentSong: string
  currentChart: string
  note: string
}

export type EmailStatus = 'pending' | 'sending' | 'sent' | 'failed'

export interface EmailRecord {
  id: string
  reservationId?: string
  recipient: string
  template: string
  status: EmailStatus
  attempts: number
  lastError: string
  sentAt?: string
  createdAt: string
  updatedAt: string
}

export interface EmailListResponse {
  emails: EmailRecord[]
  mailDriver: string
}

export interface ReservationDetailResponse {
  reservation: Reservation
  emails: EmailRecord[]
}
