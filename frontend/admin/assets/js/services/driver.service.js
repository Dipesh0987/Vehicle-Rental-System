export function createDriverService() {
  const TABLE_NAME = 'drivers';
  let clientPromise;

  const toLocalDriver = (row) => ({
    id: row.driver_id || row.id,
    name: row.full_name,
    phone: row.phone,
    email: row.email || '',
    dateOfBirth: row.date_of_birth || '',
    address: row.address || '',
    licenceNumber: row.licence_number,
    licenceExpiry: row.licence_expiry,
    licenceStatus: row.licence_status,
    availability: row.availability,
    assigned: row.current_booking || '-',
    vehicleAssigned: row.vehicle_assigned || '',
    experienceYears: row.experience_years || 0,
    photoUrl: row.photo_url || '',
    notes: row.notes || '',
    onboardedAt: row.onboarded_at || '',
    _uuid: row.id,
  });

  const toDbRow = (driver) => ({
    driver_id: driver.id,
    full_name: driver.name,
    phone: driver.phone,
    email: driver.email || null,
    date_of_birth: driver.dateOfBirth || null,
    address: driver.address || null,
    licence_number: driver.licenceNumber,
    licence_expiry: driver.licenceExpiry,
    licence_status: driver.licenceStatus,
    availability: driver.availability,
    current_booking: driver.assigned === '-' ? null : driver.assigned,
    vehicle_assigned: driver.vehicleAssigned || null,
    experience_years: driver.experienceYears || 0,
    photo_url: driver.photoUrl || null,
    notes: driver.notes || null,
  });

  async function getClient() {
    if (clientPromise) return clientPromise;

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

  async function listDrivers() {
    const client = await getClient();
    const { data: rows, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .order('onboarded_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (rows || []).map(toLocalDriver);
  }

  async function getDriver(driverId) {
    const client = await getClient();
    const { data: rows, error } = await client
      .from(TABLE_NAME)
      .select('*')
      .eq('driver_id', driverId)
      .limit(1);

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return null;
    return toLocalDriver(rows[0]);
  }

  async function addDriver(driver) {
    const client = await getClient();
    const row = toDbRow(driver);
    const { data: inserted, error } = await client
      .from(TABLE_NAME)
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toLocalDriver(inserted);
  }

  async function updateDriver(driverId, updates) {
    const client = await getClient();
    const partial = {};
    if (updates.name !== undefined) partial.full_name = updates.name;
    if (updates.phone !== undefined) partial.phone = updates.phone;
    if (updates.email !== undefined) partial.email = updates.email;
    if (updates.dateOfBirth !== undefined) partial.date_of_birth = updates.dateOfBirth;
    if (updates.address !== undefined) partial.address = updates.address;
    if (updates.licenceNumber !== undefined) partial.licence_number = updates.licenceNumber;
    if (updates.licenceExpiry !== undefined) partial.licence_expiry = updates.licenceExpiry;
    if (updates.licenceStatus !== undefined) partial.licence_status = updates.licenceStatus;
    if (updates.availability !== undefined) partial.availability = updates.availability;
    if (updates.assigned !== undefined) partial.current_booking = updates.assigned === '-' ? null : updates.assigned;
    if (updates.vehicleAssigned !== undefined) partial.vehicle_assigned = updates.vehicleAssigned;
    if (updates.experienceYears !== undefined) partial.experience_years = updates.experienceYears;
    if (updates.photoUrl !== undefined) partial.photo_url = updates.photoUrl;
    if (updates.notes !== undefined) partial.notes = updates.notes;

    const { data: updated, error } = await client
      .from(TABLE_NAME)
      .update(partial)
      .eq('driver_id', driverId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return toLocalDriver(updated);
  }

  async function deleteDriver(driverId) {
    const client = await getClient();
    const { error } = await client
      .from(TABLE_NAME)
      .delete()
      .eq('driver_id', driverId);

    if (error) throw new Error(error.message);
    return true;
  }

  return {
    listDrivers,
    getDriver,
    addDriver,
    updateDriver,
    deleteDriver,
  };
}
