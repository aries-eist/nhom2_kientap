export type UserRole = 'employee' | 'reviewer' | 'assessor' | 'coordinator' | 'assignee' | 'manager';

export type ReportStatus = 
  | 'New'               // Mới
  | 'RequestInfo'       // Yêu cầu bổ sung
  | 'Approved'        // đã phê duyệt
  | 'Rejected'        // Từ chối/Hủy
  |  'Closed';            // Đã đóng

interface TransitionRule {
  nextStates: ReportStatus[];
  allowedRoles: UserRole[];
}

const WORKFLOW_RULES: Record<ReportStatus, TransitionRule> = {
  'New': {
    nextStates: ['RequestInfo', 'Rejected'],
    allowedRoles: ['reviewer'],
  },
  'RequestInfo': {
    nextStates: ['New'],
    allowedRoles: ['employee'], 
  },
  'Approved': {
    nextStates: ['Closed'],
    allowedRoles: ['assignee', 'coordinator'],
  },
  'Rejected': {
    nextStates: [], // Trạng thái cuối, không thể chuyển tiếp
    allowedRoles: [],
  },
  'Closed': {
    nextStates: ['Approved',], // Trạng thái cuối, không thể chuyển tiếp
    allowedRoles: [],
  }
};

/**
 * Hàm kiểm tra tính hợp lệ của việc chuyển trạng thái
 */
export const validateTransition = (
  currentStatus: ReportStatus,
  nextStatus: ReportStatus,
  userRole: UserRole
): { isValid: boolean; message?: string } => {
  const rule = WORKFLOW_RULES[currentStatus];

  if (!rule) return { isValid: false, message: "Trạng thái không hợp lệ." };

  // 1. Kiểm tra luồng trạng thái
  if (!rule.nextStates.includes(nextStatus)) {
    return { isValid: false, message: `Quy trình không cho phép chuyển từ ${currentStatus} sang ${nextStatus}.` };
  }

  // 2. Kiểm tra quyền hạn vai trò
  if (!rule.allowedRoles.includes(userRole)) {
    return { isValid: false, message: "Bạn không có quyền thực hiện hành động này." };
  }

  return { isValid: true };
};

/**
 * Hàm lấy các trạng thái khả thi để hiển thị nút bấm trên UI
 */
export const getAvailableActions = (currentStatus: ReportStatus, userRole: UserRole): ReportStatus[] => {
  const rule = WORKFLOW_RULES[currentStatus];
  if (!rule || !rule.allowedRoles.includes(userRole)) return [];
  return rule.nextStates;
};