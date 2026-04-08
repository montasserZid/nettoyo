type AccountDeletionResponse = {
  success?: boolean;
  message?: string;
  deletedUserId?: string;
  removedStorageObjects?: number;
  error?: string;
};

export async function requestAccountDeletion(accessToken: string) {
  const response = await fetch('/api/account/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`
    }
  });

  let payload: AccountDeletionResponse | null = null;
  try {
    payload = (await response.json()) as AccountDeletionResponse;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.error || 'Unable to delete account right now.');
  }

  return payload;
}
