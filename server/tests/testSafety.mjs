const TEST_DATABASE_PATTERN = /(^|[-_])(test|testing|integration|qa)([-_]|$)/i;

function databaseName(uri, label) {
  if (!uri) throw new Error(`${label} is required.`);
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error(`${label} is not a valid MongoDB URI.`);
  }
  const name = decodeURIComponent(parsed.pathname.replace(/^\//, '')).trim();
  if (!name) throw new Error(`${label} must include an explicit database name.`);
  return name;
}

export function assertSafeTestDatabase({ testUri, normalUri }) {
  const testName = databaseName(testUri, 'MONGO_TEST_URI');
  const normalName = normalUri ? databaseName(normalUri, 'MONGO_URI') : null;
  if (normalName && testName === normalName) {
    throw new Error('Safety check failed: MONGO_TEST_URI points to the normal application database.');
  }
  if (!TEST_DATABASE_PATTERN.test(testName)) {
    throw new Error('Safety check failed: the test database name must clearly identify a test database.');
  }
  return { testName, normalName };
}

