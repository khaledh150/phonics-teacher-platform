// ============================================
// DETERMINISTIC COMPETITION SETS (A-J)
// 100-Question Pool → 10 Sets × 60 Questions Each
// Features: Jumbled Orders + Rotating Targets
// ============================================

// Competition constants - 4-MINUTE MODE (EXACT TIMING)
export const COMPETITION_QUESTIONS_PER_SET = 60;
export const COMPETITION_TOTAL_TIME = 240; // 4 minutes = 240 seconds
export const COMPETITION_MS_PER_QUESTION = 4000; // Exact 4000ms per question cycle

// Available set letters
export const SET_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

// ============================================
// SET DEFINITIONS
// Each entry: { id: questionId, targetIdx: 0|1|2 }
// targetIdx determines which choice is the spoken word
// Orders are jumbled to avoid predictable patterns
// Targets rotate across sets for the same question ID
// ============================================

const sets = {
  // SET A: Jumbled order, targets rotate starting at offset 0
  A: [
    { id: 47, targetIdx: 2 }, { id: 12, targetIdx: 0 }, { id: 83, targetIdx: 2 },
    { id: 5, targetIdx: 2 }, { id: 91, targetIdx: 1 }, { id: 28, targetIdx: 1 },
    { id: 64, targetIdx: 1 }, { id: 3, targetIdx: 0 }, { id: 76, targetIdx: 1 },
    { id: 39, targetIdx: 0 }, { id: 15, targetIdx: 0 }, { id: 52, targetIdx: 1 },
    { id: 8, targetIdx: 2 }, { id: 4, targetIdx: 2 }, { id: 21, targetIdx: 0 },
    { id: 67, targetIdx: 1 }, { id: 34, targetIdx: 1 }, { id: 88, targetIdx: 1 },
    { id: 1, targetIdx: 1 }, { id: 56, targetIdx: 2 }, { id: 43, targetIdx: 1 },
    { id: 79, targetIdx: 1 }, { id: 26, targetIdx: 2 }, { id: 100, targetIdx: 1 },
    { id: 17, targetIdx: 2 }, { id: 62, targetIdx: 2 }, { id: 31, targetIdx: 1 },
    { id: 74, targetIdx: 2 }, { id: 9, targetIdx: 0 }, { id: 48, targetIdx: 0 },
    { id: 85, targetIdx: 1 }, { id: 22, targetIdx: 1 }, { id: 59, targetIdx: 2 },
    { id: 36, targetIdx: 0 }, { id: 93, targetIdx: 0 }, { id: 14, targetIdx: 2 },
    { id: 71, targetIdx: 2 }, { id: 2, targetIdx: 2 }, { id: 45, targetIdx: 0 },
    { id: 82, targetIdx: 1 }, { id: 19, targetIdx: 1 }, { id: 68, targetIdx: 2 },
    { id: 33, targetIdx: 0 }, { id: 97, targetIdx: 1 }, { id: 54, targetIdx: 0 },
    { id: 11, targetIdx: 2 }, { id: 78, targetIdx: 0 }, { id: 41, targetIdx: 2 },
    { id: 6, targetIdx: 0 }, { id: 89, targetIdx: 2 }, { id: 24, targetIdx: 0 },
    { id: 63, targetIdx: 0 }, { id: 37, targetIdx: 1 }, { id: 96, targetIdx: 0 },
    { id: 50, targetIdx: 2 }, { id: 7, targetIdx: 1 }, { id: 72, targetIdx: 0 },
    { id: 29, targetIdx: 2 }, { id: 84, targetIdx: 0 }, { id: 16, targetIdx: 1 }
  ],

  // SET B: Different jumbled order, targets rotate with offset 1
  B: [
    { id: 33, targetIdx: 1 }, { id: 78, targetIdx: 1 }, { id: 4, targetIdx: 2 },
    { id: 61, targetIdx: 2 }, { id: 19, targetIdx: 2 }, { id: 87, targetIdx: 0 },
    { id: 42, targetIdx: 1 }, { id: 16, targetIdx: 2 }, { id: 94, targetIdx: 0 },
    { id: 55, targetIdx: 2 }, { id: 8, targetIdx: 0 }, { id: 73, targetIdx: 2 },
    { id: 27, targetIdx: 1 }, { id: 99, targetIdx: 1 }, { id: 38, targetIdx: 0 },
    { id: 65, targetIdx: 0 }, { id: 12, targetIdx: 1 }, { id: 81, targetIdx: 0 },
    { id: 50, targetIdx: 0 }, { id: 23, targetIdx: 0 }, { id: 96, targetIdx: 1 },
    { id: 67, targetIdx: 2 }, { id: 3, targetIdx: 1 }, { id: 44, targetIdx: 0 },
    { id: 89, targetIdx: 0 }, { id: 31, targetIdx: 2 }, { id: 76, targetIdx: 2 },
    { id: 14, targetIdx: 0 }, { id: 58, targetIdx: 0 }, { id: 1, targetIdx: 2 },
    { id: 85, targetIdx: 2 }, { id: 46, targetIdx: 2 }, { id: 21, targetIdx: 1 },
    { id: 70, targetIdx: 0 }, { id: 9, targetIdx: 1 }, { id: 36, targetIdx: 1 },
    { id: 92, targetIdx: 0 }, { id: 53, targetIdx: 0 }, { id: 17, targetIdx: 0 },
    { id: 79, targetIdx: 2 }, { id: 28, targetIdx: 2 }, { id: 64, targetIdx: 2 },
    { id: 5, targetIdx: 0 }, { id: 41, targetIdx: 0 }, { id: 86, targetIdx: 1 },
    { id: 35, targetIdx: 0 }, { id: 100, targetIdx: 2 }, { id: 62, targetIdx: 0 },
    { id: 24, targetIdx: 1 }, { id: 48, targetIdx: 1 }, { id: 7, targetIdx: 2 },
    { id: 83, targetIdx: 0 }, { id: 59, targetIdx: 0 }, { id: 11, targetIdx: 0 },
    { id: 68, targetIdx: 0 }, { id: 32, targetIdx: 0 }, { id: 91, targetIdx: 2 },
    { id: 45, targetIdx: 1 }, { id: 20, targetIdx: 0 }, { id: 75, targetIdx: 1 }
  ],

  // SET C: Different jumbled order, targets rotate with offset 2
  C: [
    { id: 22, targetIdx: 0 }, { id: 89, targetIdx: 1 }, { id: 51, targetIdx: 0 },
    { id: 7, targetIdx: 0 }, { id: 63, targetIdx: 1 }, { id: 34, targetIdx: 0 },
    { id: 98, targetIdx: 0 }, { id: 15, targetIdx: 1 }, { id: 77, targetIdx: 0 },
    { id: 46, targetIdx: 0 }, { id: 2, targetIdx: 0 }, { id: 58, targetIdx: 1 },
    { id: 83, targetIdx: 1 }, { id: 29, targetIdx: 1 }, { id: 91, targetIdx: 0 },
    { id: 12, targetIdx: 2 }, { id: 67, targetIdx: 0 }, { id: 40, targetIdx: 2 },
    { id: 94, targetIdx: 1 }, { id: 5, targetIdx: 1 }, { id: 72, targetIdx: 1 },
    { id: 19, targetIdx: 0 }, { id: 55, targetIdx: 0 }, { id: 81, targetIdx: 1 },
    { id: 36, targetIdx: 2 }, { id: 100, targetIdx: 0 }, { id: 48, targetIdx: 2 },
    { id: 26, targetIdx: 0 }, { id: 69, targetIdx: 1 }, { id: 8, targetIdx: 1 },
    { id: 43, targetIdx: 0 }, { id: 86, targetIdx: 2 }, { id: 61, targetIdx: 0 },
    { id: 14, targetIdx: 1 }, { id: 75, targetIdx: 2 }, { id: 32, targetIdx: 1 },
    { id: 97, targetIdx: 0 }, { id: 50, targetIdx: 1 }, { id: 23, targetIdx: 1 },
    { id: 79, targetIdx: 0 }, { id: 3, targetIdx: 2 }, { id: 66, targetIdx: 1 },
    { id: 38, targetIdx: 1 }, { id: 88, targetIdx: 0 }, { id: 17, targetIdx: 1 },
    { id: 54, targetIdx: 1 }, { id: 9, targetIdx: 2 }, { id: 71, targetIdx: 0 },
    { id: 28, targetIdx: 0 }, { id: 4, targetIdx: 0 }, { id: 44, targetIdx: 1 },
    { id: 60, targetIdx: 2 }, { id: 21, targetIdx: 2 }, { id: 84, targetIdx: 1 },
    { id: 11, targetIdx: 1 }, { id: 57, targetIdx: 2 }, { id: 35, targetIdx: 1 },
    { id: 92, targetIdx: 1 }, { id: 1, targetIdx: 0 }, { id: 47, targetIdx: 0 }
  ],

  // SET D: Different jumbled order, targets rotate with offset 0
  D: [
    { id: 56, targetIdx: 0 }, { id: 13, targetIdx: 2 }, { id: 81, targetIdx: 2 },
    { id: 39, targetIdx: 1 }, { id: 1, targetIdx: 1 }, { id: 4, targetIdx: 0 },
    { id: 68, targetIdx: 1 }, { id: 27, targetIdx: 2 }, { id: 84, targetIdx: 2 },
    { id: 42, targetIdx: 2 }, { id: 10, targetIdx: 0 }, { id: 73, targetIdx: 0 },
    { id: 31, targetIdx: 0 }, { id: 88, targetIdx: 2 }, { id: 19, targetIdx: 2 },
    { id: 52, targetIdx: 2 }, { id: 6, targetIdx: 1 }, { id: 99, targetIdx: 0 },
    { id: 64, targetIdx: 0 }, { id: 35, targetIdx: 2 }, { id: 78, targetIdx: 2 },
    { id: 22, targetIdx: 2 }, { id: 47, targetIdx: 1 }, { id: 90, targetIdx: 1 },
    { id: 15, targetIdx: 2 }, { id: 59, targetIdx: 1 }, { id: 2, targetIdx: 1 },
    { id: 71, targetIdx: 1 }, { id: 36, targetIdx: 1 }, { id: 93, targetIdx: 1 },
    { id: 24, targetIdx: 2 }, { id: 67, targetIdx: 2 }, { id: 8, targetIdx: 0 },
    { id: 45, targetIdx: 1 }, { id: 80, targetIdx: 0 }, { id: 18, targetIdx: 2 },
    { id: 54, targetIdx: 2 }, { id: 100, targetIdx: 0 }, { id: 33, targetIdx: 2 },
    { id: 76, targetIdx: 0 }, { id: 49, targetIdx: 0 }, { id: 12, targetIdx: 1 },
    { id: 61, targetIdx: 1 }, { id: 28, targetIdx: 0 }, { id: 87, targetIdx: 1 },
    { id: 43, targetIdx: 2 }, { id: 70, targetIdx: 2 }, { id: 16, targetIdx: 0 },
    { id: 97, targetIdx: 2 }, { id: 55, targetIdx: 1 }, { id: 3, targetIdx: 1 },
    { id: 82, targetIdx: 0 }, { id: 38, targetIdx: 2 }, { id: 91, targetIdx: 0 },
    { id: 25, targetIdx: 0 }, { id: 66, targetIdx: 2 }, { id: 50, targetIdx: 0 },
    { id: 9, targetIdx: 1 }, { id: 74, targetIdx: 1 }, { id: 21, targetIdx: 1 }
  ],

  // SET E: Different jumbled order, targets rotate with offset 1
  E: [
    { id: 44, targetIdx: 2 }, { id: 91, targetIdx: 1 }, { id: 18, targetIdx: 0 },
    { id: 72, targetIdx: 2 }, { id: 5, targetIdx: 0 }, { id: 59, targetIdx: 2 },
    { id: 33, targetIdx: 1 }, { id: 86, targetIdx: 0 }, { id: 14, targetIdx: 0 },
    { id: 69, targetIdx: 2 }, { id: 27, targetIdx: 0 }, { id: 98, targetIdx: 1 },
    { id: 41, targetIdx: 1 }, { id: 8, targetIdx: 1 }, { id: 77, targetIdx: 1 },
    { id: 50, targetIdx: 2 }, { id: 22, targetIdx: 0 }, { id: 63, targetIdx: 2 },
    { id: 1, targetIdx: 0 }, { id: 36, targetIdx: 0 }, { id: 81, targetIdx: 1 },
    { id: 10, targetIdx: 2 }, { id: 54, targetIdx: 2 }, { id: 2, targetIdx: 0 },
    { id: 67, targetIdx: 1 }, { id: 29, targetIdx: 0 }, { id: 88, targetIdx: 2 },
    { id: 45, targetIdx: 2 }, { id: 76, targetIdx: 0 }, { id: 19, targetIdx: 0 },
    { id: 58, targetIdx: 2 }, { id: 3, targetIdx: 0 }, { id: 84, targetIdx: 0 },
    { id: 31, targetIdx: 0 }, { id: 97, targetIdx: 0 }, { id: 52, targetIdx: 0 },
    { id: 15, targetIdx: 1 }, { id: 70, targetIdx: 1 }, { id: 39, targetIdx: 2 },
    { id: 93, targetIdx: 2 }, { id: 24, targetIdx: 2 }, { id: 61, targetIdx: 0 },
    { id: 7, targetIdx: 1 }, { id: 48, targetIdx: 2 }, { id: 83, targetIdx: 2 },
    { id: 35, targetIdx: 1 }, { id: 100, targetIdx: 1 }, { id: 56, targetIdx: 0 },
    { id: 12, targetIdx: 0 }, { id: 79, targetIdx: 0 }, { id: 43, targetIdx: 2 },
    { id: 66, targetIdx: 0 }, { id: 21, targetIdx: 2 }, { id: 90, targetIdx: 2 },
    { id: 47, targetIdx: 0 }, { id: 13, targetIdx: 0 }, { id: 74, targetIdx: 0 },
    { id: 38, targetIdx: 1 }, { id: 85, targetIdx: 2 }, { id: 26, targetIdx: 1 }
  ],

  // SET F: Different jumbled order, targets rotate with offset 2
  F: [
    { id: 71, targetIdx: 1 }, { id: 28, targetIdx: 2 }, { id: 93, targetIdx: 2 },
    { id: 6, targetIdx: 2 }, { id: 49, targetIdx: 1 }, { id: 82, targetIdx: 2 },
    { id: 17, targetIdx: 0 }, { id: 64, targetIdx: 0 }, { id: 35, targetIdx: 0 },
    { id: 100, targetIdx: 2 }, { id: 52, targetIdx: 1 }, { id: 9, targetIdx: 0 },
    { id: 78, targetIdx: 1 }, { id: 23, targetIdx: 2 }, { id: 67, targetIdx: 0 },
    { id: 40, targetIdx: 0 }, { id: 86, targetIdx: 1 }, { id: 13, targetIdx: 1 },
    { id: 59, targetIdx: 0 }, { id: 4, targetIdx: 1 }, { id: 91, targetIdx: 2 },
    { id: 32, targetIdx: 2 }, { id: 75, targetIdx: 0 }, { id: 20, targetIdx: 1 },
    { id: 56, targetIdx: 1 }, { id: 43, targetIdx: 0 }, { id: 98, targetIdx: 2 },
    { id: 61, targetIdx: 1 }, { id: 15, targetIdx: 2 }, { id: 84, targetIdx: 2 },
    { id: 37, targetIdx: 0 }, { id: 70, targetIdx: 0 }, { id: 2, targetIdx: 1 },
    { id: 47, targetIdx: 1 }, { id: 88, targetIdx: 0 }, { id: 25, targetIdx: 1 },
    { id: 54, targetIdx: 0 }, { id: 11, targetIdx: 2 }, { id: 79, targetIdx: 1 },
    { id: 33, targetIdx: 0 }, { id: 96, targetIdx: 2 }, { id: 62, targetIdx: 1 },
    { id: 8, targetIdx: 2 }, { id: 45, targetIdx: 1 }, { id: 19, targetIdx: 1 },
    { id: 73, targetIdx: 2 }, { id: 30, targetIdx: 0 }, { id: 87, targetIdx: 2 },
    { id: 50, targetIdx: 0 }, { id: 3, targetIdx: 2 }, { id: 68, targetIdx: 1 },
    { id: 24, targetIdx: 0 }, { id: 5, targetIdx: 1 }, { id: 41, targetIdx: 2 },
    { id: 77, targetIdx: 2 }, { id: 14, targetIdx: 2 }, { id: 58, targetIdx: 0 },
    { id: 81, targetIdx: 0 }, { id: 39, targetIdx: 0 }, { id: 1, targetIdx: 2 }
  ],

  // SET G: Different jumbled order, targets rotate with offset 0
  G: [
    { id: 85, targetIdx: 0 }, { id: 42, targetIdx: 0 }, { id: 7, targetIdx: 2 },
    { id: 60, targetIdx: 1 }, { id: 23, targetIdx: 0 }, { id: 96, targetIdx: 1 },
    { id: 51, targetIdx: 2 }, { id: 14, targetIdx: 1 }, { id: 78, targetIdx: 0 },
    { id: 33, targetIdx: 1 }, { id: 89, targetIdx: 0 }, { id: 46, targetIdx: 1 },
    { id: 11, targetIdx: 0 }, { id: 68, targetIdx: 0 }, { id: 25, targetIdx: 2 },
    { id: 94, targetIdx: 2 }, { id: 37, targetIdx: 2 }, { id: 72, targetIdx: 2 },
    { id: 4, targetIdx: 2 }, { id: 57, targetIdx: 1 }, { id: 18, targetIdx: 1 },
    { id: 83, targetIdx: 0 }, { id: 30, targetIdx: 1 }, { id: 99, targetIdx: 2 },
    { id: 62, targetIdx: 0 }, { id: 9, targetIdx: 2 }, { id: 44, targetIdx: 1 },
    { id: 76, targetIdx: 2 }, { id: 21, targetIdx: 2 }, { id: 53, targetIdx: 1 },
    { id: 87, targetIdx: 0 }, { id: 2, targetIdx: 0 }, { id: 65, targetIdx: 1 },
    { id: 38, targetIdx: 0 }, { id: 91, targetIdx: 2 }, { id: 16, targetIdx: 2 },
    { id: 74, targetIdx: 0 }, { id: 49, targetIdx: 2 }, { id: 80, targetIdx: 1 },
    { id: 27, targetIdx: 0 }, { id: 63, targetIdx: 2 }, { id: 10, targetIdx: 1 },
    { id: 55, targetIdx: 0 }, { id: 92, targetIdx: 0 }, { id: 35, targetIdx: 0 },
    { id: 70, targetIdx: 1 }, { id: 5, targetIdx: 1 }, { id: 48, targetIdx: 1 },
    { id: 81, targetIdx: 2 }, { id: 20, targetIdx: 0 }, { id: 97, targetIdx: 1 },
    { id: 43, targetIdx: 0 }, { id: 66, targetIdx: 0 }, { id: 29, targetIdx: 1 },
    { id: 84, targetIdx: 1 }, { id: 12, targetIdx: 2 }, { id: 59, targetIdx: 0 },
    { id: 36, targetIdx: 2 }, { id: 3, targetIdx: 0 }, { id: 1, targetIdx: 0 }
  ],

  // SET H: Different jumbled order, targets rotate with offset 1
  H: [
    { id: 63, targetIdx: 1 }, { id: 20, targetIdx: 1 }, { id: 97, targetIdx: 2 },
    { id: 34, targetIdx: 2 }, { id: 81, targetIdx: 0 }, { id: 12, targetIdx: 0 },
    { id: 58, targetIdx: 1 }, { id: 45, targetIdx: 0 }, { id: 90, targetIdx: 0 },
    { id: 7, targetIdx: 0 }, { id: 52, targetIdx: 0 }, { id: 29, targetIdx: 0 },
    { id: 76, targetIdx: 1 }, { id: 41, targetIdx: 0 }, { id: 88, targetIdx: 1 },
    { id: 15, targetIdx: 0 }, { id: 69, targetIdx: 1 }, { id: 2, targetIdx: 1 },
    { id: 55, targetIdx: 1 }, { id: 94, targetIdx: 0 }, { id: 38, targetIdx: 2 },
    { id: 73, targetIdx: 1 }, { id: 16, targetIdx: 0 }, { id: 61, targetIdx: 2 },
    { id: 84, targetIdx: 2 }, { id: 47, targetIdx: 2 }, { id: 10, targetIdx: 0 },
    { id: 99, targetIdx: 0 }, { id: 32, targetIdx: 1 }, { id: 67, targetIdx: 0 },
    { id: 4, targetIdx: 0 }, { id: 79, targetIdx: 2 }, { id: 22, targetIdx: 1 },
    { id: 56, targetIdx: 2 }, { id: 91, targetIdx: 0 }, { id: 43, targetIdx: 1 },
    { id: 8, targetIdx: 2 }, { id: 65, targetIdx: 2 }, { id: 28, targetIdx: 1 },
    { id: 86, targetIdx: 2 }, { id: 49, targetIdx: 0 }, { id: 14, targetIdx: 1 },
    { id: 71, targetIdx: 0 }, { id: 36, targetIdx: 1 }, { id: 93, targetIdx: 1 },
    { id: 50, targetIdx: 1 }, { id: 25, targetIdx: 0 }, { id: 82, targetIdx: 1 },
    { id: 19, targetIdx: 2 }, { id: 60, targetIdx: 0 }, { id: 3, targetIdx: 1 },
    { id: 44, targetIdx: 0 }, { id: 77, targetIdx: 0 }, { id: 35, targetIdx: 2 },
    { id: 100, targetIdx: 0 }, { id: 57, targetIdx: 0 }, { id: 24, targetIdx: 1 },
    { id: 68, targetIdx: 2 }, { id: 9, targetIdx: 1 }, { id: 40, targetIdx: 1 }
  ],

  // SET I: Different jumbled order, targets rotate with offset 2
  I: [
    { id: 38, targetIdx: 0 }, { id: 4, targetIdx: 2 }, { id: 62, targetIdx: 2 },
    { id: 11, targetIdx: 1 }, { id: 74, targetIdx: 1 }, { id: 29, targetIdx: 2 },
    { id: 83, targetIdx: 1 }, { id: 50, targetIdx: 1 }, { id: 7, targetIdx: 1 },
    { id: 44, targetIdx: 2 }, { id: 91, targetIdx: 1 }, { id: 18, targetIdx: 2 },
    { id: 67, targetIdx: 2 }, { id: 2, targetIdx: 2 }, { id: 56, targetIdx: 0 },
    { id: 23, targetIdx: 1 }, { id: 80, targetIdx: 2 }, { id: 35, targetIdx: 1 },
    { id: 98, targetIdx: 0 }, { id: 59, targetIdx: 1 }, { id: 14, targetIdx: 2 },
    { id: 47, targetIdx: 0 }, { id: 86, targetIdx: 0 }, { id: 31, targetIdx: 2 },
    { id: 72, targetIdx: 0 }, { id: 5, targetIdx: 0 }, { id: 40, targetIdx: 0 },
    { id: 93, targetIdx: 0 }, { id: 26, targetIdx: 1 }, { id: 69, targetIdx: 0 },
    { id: 12, targetIdx: 1 }, { id: 55, targetIdx: 2 }, { id: 88, targetIdx: 1 },
    { id: 33, targetIdx: 2 }, { id: 76, targetIdx: 0 }, { id: 21, targetIdx: 0 },
    { id: 64, targetIdx: 2 }, { id: 9, targetIdx: 0 }, { id: 42, targetIdx: 1 },
    { id: 99, targetIdx: 1 }, { id: 16, targetIdx: 1 }, { id: 53, targetIdx: 2 },
    { id: 78, targetIdx: 2 }, { id: 37, targetIdx: 1 }, { id: 84, targetIdx: 0 },
    { id: 27, targetIdx: 1 }, { id: 60, targetIdx: 1 }, { id: 3, targetIdx: 0 },
    { id: 46, targetIdx: 2 }, { id: 89, targetIdx: 2 }, { id: 20, targetIdx: 2 },
    { id: 71, targetIdx: 2 }, { id: 8, targetIdx: 0 }, { id: 51, targetIdx: 1 },
    { id: 94, targetIdx: 2 }, { id: 41, targetIdx: 0 }, { id: 66, targetIdx: 2 },
    { id: 15, targetIdx: 0 }, { id: 82, targetIdx: 2 }, { id: 1, targetIdx: 1 }
  ],

  // SET J: Different jumbled order, targets rotate with offset 0
  J: [
    { id: 79, targetIdx: 0 }, { id: 36, targetIdx: 0 }, { id: 93, targetIdx: 2 },
    { id: 14, targetIdx: 0 }, { id: 51, targetIdx: 1 }, { id: 88, targetIdx: 0 },
    { id: 25, targetIdx: 1 }, { id: 68, targetIdx: 2 }, { id: 3, targetIdx: 2 },
    { id: 46, targetIdx: 0 }, { id: 81, targetIdx: 1 }, { id: 22, targetIdx: 0 },
    { id: 59, targetIdx: 2 }, { id: 96, targetIdx: 2 }, { id: 33, targetIdx: 1 },
    { id: 70, targetIdx: 0 }, { id: 17, targetIdx: 1 }, { id: 54, targetIdx: 1 },
    { id: 91, targetIdx: 0 }, { id: 8, targetIdx: 1 }, { id: 45, targetIdx: 2 },
    { id: 28, targetIdx: 2 }, { id: 73, targetIdx: 0 }, { id: 10, targetIdx: 2 },
    { id: 65, targetIdx: 0 }, { id: 40, targetIdx: 1 }, { id: 97, targetIdx: 0 },
    { id: 52, targetIdx: 2 }, { id: 19, targetIdx: 0 }, { id: 84, targetIdx: 2 },
    { id: 31, targetIdx: 1 }, { id: 66, targetIdx: 1 }, { id: 5, targetIdx: 0 },
    { id: 42, targetIdx: 2 }, { id: 87, targetIdx: 2 }, { id: 24, targetIdx: 1 },
    { id: 61, targetIdx: 0 }, { id: 2, targetIdx: 0 }, { id: 49, targetIdx: 1 },
    { id: 76, targetIdx: 2 }, { id: 13, targetIdx: 0 }, { id: 58, targetIdx: 2 },
    { id: 35, targetIdx: 2 }, { id: 90, targetIdx: 1 }, { id: 47, targetIdx: 1 },
    { id: 72, targetIdx: 1 }, { id: 29, targetIdx: 0 }, { id: 86, targetIdx: 2 },
    { id: 43, targetIdx: 2 }, { id: 6, targetIdx: 2 }, { id: 77, targetIdx: 0 },
    { id: 20, targetIdx: 0 }, { id: 63, targetIdx: 1 }, { id: 100, targetIdx: 2 },
    { id: 37, targetIdx: 0 }, { id: 94, targetIdx: 1 }, { id: 55, targetIdx: 2 },
    { id: 12, targetIdx: 2 }, { id: 69, targetIdx: 0 }, { id: 1, targetIdx: 2 }
  ]
};

// ============================================
// GET SET QUESTIONS WITH TARGET INFO
// Returns array of { id, choices, targetIdx, targetWord }
// ============================================
export const getSetQuestions = (setLetter, allQuestions) => {
  const setData = sets[setLetter];
  if (!setData) {
    console.error(`Invalid set letter: ${setLetter}`);
    return [];
  }

  return setData.map((entry) => {
    const question = allQuestions.find((q) => q.id === entry.id);
    if (!question) {
      console.error(`Question ID ${entry.id} not found`);
      return null;
    }

    return {
      id: question.id,
      choices: question.choices,
      targetIdx: entry.targetIdx,
      sound: question.choices[entry.targetIdx]
    };
  }).filter(Boolean);
};

export default sets;
