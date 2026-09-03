export type Role = 'ADMIN' | 'MANAGER' | 'AGENT' | 'VIEWER'

export type User = { id: string; name: string; email: string; role: Role }

export type Employee = User & { phone?: string | null; team?: string | null; active: boolean }

export type Client = {
  id: string
  fullName: string
  phone: string
  email: string | null
  leadStatus: string
  referralSource: string | null
  referralDate: string | null
  inquiryType: string | null
  inquiryStatus: string | null
  ownerId: string | null
  owner?: { id: string; name: string } | null
  preferredContact: string
  doNotContact: boolean
  introNotes: string | null
  createdAt: string
  updatedAt: string
  _count?: { files: number }
  files?: MortgageFileSummary[]
}

export type MortgageFileSummary = {
  id: string
  fileNumber: string
  stage: string
  status: string
  urgency: string
  requestedAmount: string | null
  propertyAddress: string | null
  updatedAt: string
}

export type MortgageFile = MortgageFileSummary & {
  clientId: string
  client: Client
  ownerId: string | null
  owner?: { id: string; name: string } | null
  agencyFee: string | null
  dealType: string | null
  propertyType: string | null
  purchasePrice: string | null
  propertyValue: string | null
  ltvPercent: string | null
  equity: string | null
  desiredMonthly: string | null
  requiredIncome: string | null
  borrowersIncome: string | null
  existingLiabilities: string | null
  nextPaymentDate: string | null
  executionDeadline: string | null
  targetBankId: string | null
  targetBank?: { id: string; name: string } | null
  blockReason: string | null
  lastAction: string | null
  nextAction: string | null
  nextActionDate: string | null
  createdAt: string
  tasks?: Task[]
  documents?: Doc[]
  bankApps?: BankApplication[]
  expenses?: OfficeExpense[]
  professionals?: FileProfessional[]
  communications?: Communication[]
  _count?: { tasks: number; documents: number; bankApps: number }
}

export type TaskFileRef = {
  id: string
  fileNumber: string
  client: { fullName: string }
}

export type Task = {
  id: string
  seq: number
  title: string
  fileId: string
  stage: string | null
  ownerId: string | null
  owner?: { id: string; name: string } | null
  dueAt: string | null
  priority: string
  status: string
  waitingOn: string | null
  description: string | null
  result: string | null
  completionNote: string | null
  completedAt: string | null
  createdAt: string
  file?: TaskFileRef
  escalationRule?: string | null
  createdBy?: { id: string; name: string } | null
}

export type Doc = {
  id: string
  seq: number
  storagePath?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  fileId?: string | null
  file?: TaskFileRef | null
  reviewedBy?: { id: string; name: string } | null
  docType: string
  fileName: string
  status: string
  isValid: boolean | null
  issueNotes: string | null
  version: number
  periodLabel: string | null
  receivedAt: string | null
  expiresAt: string | null
  allowedForBank: boolean
  notes: string | null
  createdAt: string
}

export type BankApplication = {
  id: string
  seq: number
  fileId: string
  file?: TaskFileRef
  bankId: string
  bank?: { id: string; name: string }
  branch?: { id: string; name: string; code?: string | null } | null
  banker?: { id: string; name: string } | null
  status: string
  submittedAt: string | null
  requestedAmount: string | null
  ltvPercent: string | null
  offeredRates: string | null
  mixNotes: string | null
  missingItems: string | null
  approvalInPrinciple: boolean
  approvalDate: string | null
  approvalValidUntil: string | null
  rejectionReason: string | null
  isChosen: boolean
}

export type OfficeExpense = {
  id: string
  amount: string
  details: string
  spentAt: string
}

export type Attachment = {
  id: string
  kind: 'FILE' | 'VOICE'
  fileName: string
  mimeType: string
  sizeBytes: number
  durationMs: number | null
}

export type Comment = {
  id: string
  entityType: string
  entityId: string
  body: string
  editedAt: string | null
  createdAt: string
  author: { id: string; name: string; role: Role }
  mentions: { id: string; name: string }[]
  attachments: Attachment[]
}

export type Communication = {
  id: string
  fileId: string
  occurredAt: string
  type: string
  direction: 'IN' | 'OUT' | null
  sender: string | null
  recipient: string | null
  subject: string | null
  summary: string | null
  body: string | null
  followUpTaskId: string | null
  followUpTask?: { id: string; title: string; status: string; seq: number } | null
  author?: { id: string; name: string } | null
  attachments: { id: string; docType: string; fileName: string; storagePath: string | null }[]
}

export type Professional = {
  id: string
  role: string
  name: string
  phone: string | null
  email: string | null
  organization: string | null
  address: string | null
  notes: string | null
}

export type FileProfessional = {
  fileId: string
  professionalId: string
  roleInFile: string
  professional: Professional
}

export type Expense = {
  id: string
  fileId: string
  amount: string
  details: string
  spentAt: string
}

export type Notification = {
  id: string
  entityType: string
  entityId: string
  commentId: string | null
  preview: string
  readAt: string | null
  createdAt: string
  actor: { id: string; name: string } | null
}

export type ActivityEntry = {
  id: string
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
  actor: { id: string; name: string } | null
}

export type BlockedFile = {
  id: string
  fileNumber: string
  clientName: string
  reason: string | null
  daysBlocked: number
}

export type Dashboard = {
  kpis: {
    tasksToday: number
    overdueTasks: number
    activeFiles: number
    waitingOnBank: number
  }
  dueToday: Task[]
  blockedFiles: BlockedFile[]
  activity: ActivityEntry[]
  pipeline: { stage: string; active: number; blocked: number; onHold: number }[]
}
