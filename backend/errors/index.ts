export type { ErrorCode, ApiError } from './types.js';
export { ERROR_CODES } from './codes.js';
export { createError } from './error.factory.js';
export { sendError } from './error.mapper.js';

// Domain error mappers & constructors
export { mapCorsError } from './cors.errors.js';
export {
  mapAuthError,
  authMissingTokenError,
  authInvalidTokenError,
  authForbiddenError,
  authNotDemoSessionError,
  authUserNotFoundError,
} from './auth.errors.js';
export {
  mapFileError,
  fileNotFoundError,
  fileNotYoursError,
  filePrivateError,
  fileInvalidNameError,
} from './files.errors.js';
export {
  mapUploadError,
  uploadNoFileError,
  uploadMissingParamsError,
  uploadInvalidParamsError,
  uploadUnknownIdError,
  uploadNotYoursError,
  uploadCorruptMetadataError,
} from './upload.errors.js';
export { mapStorageError, storageNoValidFieldsError } from './storage.errors.js';
export { dbInvalidTableError, dbLastAdminError } from './db.errors.js';
export {
  integrityCheckNotFoundError,
  integrityMissingParamError,
  integrityForbiddenError,
} from './integrity.errors.js';
export { backupNotFoundError, backupNoFileError } from './backup.errors.js';
export { actionNotFoundError } from './actions.errors.js';
export { validationError } from './validation.errors.js';
