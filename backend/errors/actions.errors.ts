import { createError } from './error.factory.js';

export function actionNotFoundError() {
  return createError('ACTION_NOT_FOUND', 'action.not_found', 404, 'Action not found or already undone');
}
