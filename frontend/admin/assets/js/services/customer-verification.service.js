const VERIFICATION_STATUSES = ['not_submitted', 'pending', 'approved', 'rejected'];
const VERIFICATION_DOCUMENT_TYPES = ['driving_license', 'national_id', 'passport', 'other'];
const VERIFICATION_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

const PROFILE_BASE_SELECT = 'id,email,full_name,created_at,updated_at';
const PROFILE_VERIFICATION_SELECT = [
  PROFILE_BASE_SELECT,
  'phone_number',
  'gender',
  'date_of_birth',
  'address_line',
  'city',
  'country',
  'postal_code',
  'document_type',
  'document_number',
  'document_image_url',
  'document_expiry_date',
  'verification_status',
  'verification_submitted_at',
  'verification_reviewed_at',
  'verification_reviewed_by',
  'verification_note',
].join(',');

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (VERIFICATION_STATUSES.includes(normalized)) {
    return normalized;
  }

  return 'not_submitted';
}

function normalizeGender(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (VERIFICATION_GENDERS.includes(normalized)) {
    return normalized;
  }

  return '';
}

function normalizeDocumentType(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (VERIFICATION_DOCUMENT_TYPES.includes(normalized)) {
    return normalized;
  }

  return '';
}

function statusLabel(status) {
  const normalized = normalizeStatus(status);

  if (normalized === 'approved') return 'Approved';
  if (normalized === 'pending') return 'Pending Review';
  if (normalized === 'rejected') return 'Rejected';
  return 'Pending';
}

function documentTypeLabel(type) {
  const normalized = normalizeDocumentType(type);

  if (normalized === 'driving_license') return 'Driving License';
  if (normalized === 'national_id') return 'National ID';
  if (normalized === 'passport') return 'Passport';
  if (normalized === 'other') return 'Other';
  return 'None';
}

function mapProfileRow(row) {
  const source = row || {};
  const verificationStatus = normalizeStatus(source.verification_status);

  return {
    userId: normalizeText(source.id),
    email: normalizeText(source.email).toLowerCase(),
    fullName: normalizeText(source.full_name) || 'Customer',
    phoneNumber: normalizeText(source.phone_number),
    gender: normalizeGender(source.gender),
    dateOfBirth: normalizeText(source.date_of_birth),
    addressLine: normalizeText(source.address_line),
    city: normalizeText(source.city),
    country: normalizeText(source.country) || 'Nepal',
    postalCode: normalizeText(source.postal_code),
    documentType: normalizeDocumentType(source.document_type),
    documentTypeLabel: documentTypeLabel(source.document_type),
    documentNumber: normalizeText(source.document_number),
    documentImageUrl: normalizeText(source.document_image_url),
    documentExpiryDate: normalizeText(source.document_expiry_date),
    verificationStatus,
    verificationStatusLabel: statusLabel(verificationStatus),
    verificationSubmittedAt: normalizeText(source.verification_submitted_at),
    verificationReviewedAt: normalizeText(source.verification_reviewed_at),
    verificationReviewedBy: normalizeText(source.verification_reviewed_by),
    verificationNote: normalizeText(source.verification_note),
    createdAt: normalizeText(source.created_at),
    updatedAt: normalizeText(source.updated_at),
  };
}

function toTimestamp(value) {
  const text = normalizeText(value);
  if (!text) {
    return 0;
  }

  const parsed = new Date(text).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function reviewQueuePriority(profile) {
  const status = normalizeStatus(profile && profile.verificationStatus);
  const submittedAt = toTimestamp(profile && profile.verificationSubmittedAt);
  const hasSubmission = submittedAt > 0;

  if (status === 'pending' && hasSubmission) return 0;
  if (status === 'rejected' && hasSubmission) return 1;
  if (status === 'not_submitted') return 2;
  if (status === 'approved') return 3;
  return 4;
}

function sortProfilesForReviewQueue(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];

  list.sort((left, right) => {
    const leftPriority = reviewQueuePriority(left);
    const rightPriority = reviewQueuePriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    const leftSubmitted = toTimestamp(left && left.verificationSubmittedAt);
    const rightSubmitted = toTimestamp(right && right.verificationSubmittedAt);
    if (leftSubmitted !== rightSubmitted) {
      return rightSubmitted - leftSubmitted;
    }

    const leftUpdated = toTimestamp(left && left.updatedAt);
    const rightUpdated = toTimestamp(right && right.updatedAt);
    if (leftUpdated !== rightUpdated) {
      return rightUpdated - leftUpdated;
    }

    const leftCreated = toTimestamp(left && left.createdAt);
    const rightCreated = toTimestamp(right && right.createdAt);
    return rightCreated - leftCreated;
  });

  return list;
}

function getErrorMessage(error) {
  return String(error && error.message ? error.message : '').toLowerCase();
}

function isMissingVerificationSchemaError(error) {
  const message = getErrorMessage(error);

  if (message.includes('admin_update_user_verification_status')) {
    return true;
  }

  if (!message.includes('column') || !message.includes('does not exist')) {
    return false;
  }

  return (
    message.includes('verification_status') ||
    message.includes('verification_submitted_at') ||
    message.includes('verification_reviewed_at') ||
    message.includes('verification_reviewed_by') ||
    message.includes('verification_note') ||
    message.includes('document_type') ||
    message.includes('document_number') ||
    message.includes('document_image_url') ||
    message.includes('phone_number')
  );
}

function isMissingAdminListRpcError(error) {
  const message = getErrorMessage(error);
  const code = String(error && error.code ? error.code : '').toUpperCase();
  const status = Number(error && error.status ? error.status : 0);

  if (code === 'PGRST202' || status === 404) {
    return true;
  }

  return (
    message.includes('admin_list_user_profiles') &&
    (
      message.includes('could not find') ||
      (message.includes('function') && message.includes('does not exist'))
    )
  );
}

function toPublicError(error, fallbackMessage = 'Unable to process customer verification right now.') {
  const message = getErrorMessage(error);

  if (isMissingVerificationSchemaError(error)) {
    return 'Verification workflow schema is missing. Run database/migrations/012_user_profile_verification_workflow.sql and database/migrations/013_verification_document_image_url.sql.';
  }

  if (message.includes('only admin users can update verification status')) {
    return 'Your admin account is not allowed to update verification status.';
  }

  if (message.includes('permission denied') || message.includes('row-level security')) {
    return 'Admin permission check failed for customer verification actions.';
  }

  if (message.includes('invalid verification status')) {
    return 'Verification status is invalid for this action.';
  }

  return fallbackMessage;
}

export function createCustomerVerificationService() {
  let clientPromise = null;

  async function getClient() {
    if (window.SupabaseRuntime && window.SupabaseRuntime.client) {
      return window.SupabaseRuntime.client;
    }

    if (clientPromise) {
      return clientPromise;
    }

    clientPromise = (async () => {
      if (!window.SupabaseClient || typeof window.SupabaseClient.init !== 'function') {
        throw new Error('Supabase client bootstrap is missing.');
      }

      if (!window.SupabaseClient.isConfigured()) {
        throw new Error('Supabase configuration is missing.');
      }

      return window.SupabaseClient.init();
    })();

    return clientPromise;
  }

  async function listCustomers() {
    const client = await getClient();

    let response = await client
      .from('user_profiles')
      .select(PROFILE_VERIFICATION_SELECT)
      .order('updated_at', { ascending: false });

    if (response.error && isMissingVerificationSchemaError(response.error)) {
      response = await client
        .from('user_profiles')
        .select(PROFILE_BASE_SELECT)
        .order('updated_at', { ascending: false });
    }

    if (response.error) {
      throw response.error;
    }

    const rows = Array.isArray(response.data) ? response.data : [];
    return sortProfilesForReviewQueue(rows.map(mapProfileRow));
  }

  async function updateVerificationStatus(input) {
    const payload = input || {};
    const userId = normalizeText(payload.userId || payload.id);
    const status = normalizeStatus(payload.status);
    const reviewNote = normalizeText(payload.reviewNote || payload.note) || null;

    if (!userId) {
      throw new Error('Customer profile id is required.');
    }

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      throw new Error('Invalid verification status.');
    }

    const client = await getClient();
    const response = await client.rpc('admin_update_user_verification_status', {
      p_user_id: userId,
      p_status: status,
      p_review_note: reviewNote,
    });

    if (response.error) {
      throw response.error;
    }

    const row = Array.isArray(response.data) ? (response.data[0] || null) : response.data;
    if (!row) {
      throw new Error('No customer row returned after verification update.');
    }

    return mapProfileRow(row);
  }

  return {
    statuses: VERIFICATION_STATUSES.slice(),
    statusLabel,
    toPublicError,
    listCustomers,
    updateVerificationStatus,
  };
}
