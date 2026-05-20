export function createCatalogService({ data }) {
  const TABLE_NAME = 'vehicles';
  let clientPromise;
  let vehicleCache = null;
  let vehicleCacheTime = 0;
  const CACHE_TTL_MS = 30000;

  const toLocalVehicle = (row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    seats: Number(row.seats || 5),
    fuel_type: row.fuel_type,
    fuelType: row.fuel_type || 'Petrol',
    status: row.status,
    primary_image_url: row.primary_image_url,
    category: row.category || row.type || 'Vehicle',
    transmission: row.transmission || 'Automatic',
    rating: Number(row.rating || 4.6),
    location: row.location,
    available: row.available,
    is_active: row.is_active,
    brand: row.brand || 'General',
    vehicle_number: row.vehicle_number || '',
    vehicleNumber: row.vehicle_number || '',
    price_per_day: Number(row.price_per_day || 0),
    daily: Number(row.price_per_day || 0),
    weekly: Math.round(Number(row.price_per_day || 0) * 6.2),
    seasonal: Math.round(Number(row.price_per_day || 0) * 24),
    addedAt: row.created_at || row.updated_at || '',
    addedDate: row.created_at || row.updated_at || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    image: row.primary_image_url || row.image_url || 'https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=640&q=80',
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

  function invalidateCache() {
    vehicleCache = null;
    vehicleCacheTime = 0;
  }

  async function loadVehiclesFromDatabase() {
    const now = Date.now();
    if (vehicleCache && (now - vehicleCacheTime) < CACHE_TTL_MS) {
      return vehicleCache;
    }

    const client = await getClient();
    const { data: rows, error } = await client
      .from(TABLE_NAME)
      .select('id,name,type,seats,price_per_day,fuel_type,status,primary_image_url,category,transmission,rating,location,available,is_active,brand,image_url,vehicle_number,created_at,updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      const fallback = await client
        .from(TABLE_NAME)
        .select('id,name,type,seats,price_per_day,fuel_type,status,primary_image_url,category,transmission,rating,location,available,is_active,brand,image_url,vehicle_number,created_at,updated_at')
        .order('id', { ascending: false });

      if (fallback.error) {
        throw new Error(fallback.error.message || 'Failed to load vehicles from database.');
      }

      return (fallback.data || []).map(toLocalVehicle);
    }

    const result = (rows || []).map(toLocalVehicle);
    vehicleCache = result;
    vehicleCacheTime = Date.now();
    return result;
  }

  return {
    async loadVehicles() {
      const rows = await loadVehiclesFromDatabase();
      data.vehicles.splice(0, data.vehicles.length, ...rows);
      return data.vehicles;
    },

    async saveVehicle(vehicleInput, id) {
      if (!vehicleInput || typeof vehicleInput !== 'object') {
        throw new Error('Vehicle payload is required.');
      }

      const client = await getClient();

      // The admin create-form sends camelCase keys (pricePerDay, fuelType,
      // primaryImageUrl) while the edit-form sends snake_case keys.
      // Accept both shapes here so a missing key never silently becomes
      // NaN / null and trips the NOT NULL constraint on price_per_day or
      // fuel_type. `??` keeps explicit zero / empty-string values intact.
      const pickFirstDefined = (...values) => {
        for (let i = 0; i < values.length; i += 1) {
          if (values[i] !== undefined && values[i] !== null && values[i] !== '') {
            return values[i];
          }
        }
        return undefined;
      };

      const rawPrice = pickFirstDefined(
        vehicleInput.price_per_day,
        vehicleInput.pricePerDay,
        vehicleInput.daily
      );
      const rawFuelType = pickFirstDefined(vehicleInput.fuel_type, vehicleInput.fuelType);
      const rawImage = pickFirstDefined(
        vehicleInput.primary_image_url,
        vehicleInput.primaryImageUrl,
        vehicleInput.image
      );
      const rawStatus = String(vehicleInput.status || 'available').toLowerCase();
      // The DB check constraint is lower-case ('available' | 'maintenance' |
      // 'inactive'). The admin form sends 'Available' from the <select>, so
      // normalise here.
      const normalizedStatus = ['available', 'maintenance', 'inactive'].includes(rawStatus)
        ? rawStatus
        : 'available';

      const priceNumber = Number(rawPrice);
      const seatsNumber = Number(vehicleInput.seats);
      const ratingNumber = Number(pickFirstDefined(vehicleInput.rating, 4.6));

      // Fail fast with a readable error instead of letting the DB reject
      // NaN / null and surface a cryptic "violates not-null constraint" toast.
      if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
        throw new Error('Daily price (price_per_day) is required and must be greater than zero.');
      }
      if (!rawFuelType) {
        throw new Error('Fuel type is required (Petrol, Diesel, or Electric).');
      }
      if (!Number.isFinite(seatsNumber) || seatsNumber < 1) {
        throw new Error('Seats is required and must be at least 1.');
      }
      if (!vehicleInput.name || !String(vehicleInput.name).trim()) {
        throw new Error('Vehicle name is required.');
      }
      if (!vehicleInput.type && !vehicleInput.category) {
        throw new Error('Vehicle type / category is required.');
      }

      // Resolve vehicle_number from multiple possible key names
      const rawVehicleNumber = String(
        vehicleInput.vehicle_number || vehicleInput.vehicleNumber || vehicleInput.registrationNumber || ''
      ).trim().toUpperCase();

      const rawType = String(vehicleInput.type || vehicleInput.category || 'sedan').trim().toLowerCase();

      const normalized = {
        name: String(vehicleInput.name).trim(),
        type: rawType,
        seats: seatsNumber,
        price_per_day: priceNumber,
        fuel_type: rawFuelType,
        status: normalizedStatus,
        primary_image_url: rawImage,
        category: vehicleInput.category || vehicleInput.type,
        transmission: vehicleInput.transmission || 'Automatic',
        rating: Number.isFinite(ratingNumber) ? ratingNumber : 4.6,
        location: vehicleInput.location || '',
        vehicle_number: rawVehicleNumber || null,
        // Admin create form does not send these flags, so default to true so
        // newly added vehicles immediately appear in the public catalog
        // instead of being silently created as hidden / inactive.
        available: vehicleInput.available !== undefined ? Boolean(vehicleInput.available) : true,
        is_active: vehicleInput.is_active !== undefined ? Boolean(vehicleInput.is_active) : true,
        brand: vehicleInput.brand || 'General',
      };

      if (id) {
        const { error } = await client
          .from(TABLE_NAME)
          .update(normalized)
          .eq('id', id);

        if (error) {
          throw new Error(error.message || `Vehicle ${id} update failed.`);
        }

        const updated = toLocalVehicle(normalized);

        const index = data.vehicles.findIndex((vehicle) => vehicle.id === id);
        if (index >= 0) data.vehicles.splice(index, 1);
        data.vehicles.unshift(updated);

        return updated;
      }

      const record = {
        ...normalized,
      };

      const { error, data: inserted } = await client.from(TABLE_NAME).insert(record).select('*').single();
      if (error) {
        throw new Error(error.message || 'Vehicle creation failed.');
      }

      const created = toLocalVehicle(inserted || record);
      data.vehicles.unshift(created);
      invalidateCache();
      return created;
    },

    async deleteVehicle(id) {
      if (!id) {
        throw new Error('Vehicle id is required.');
      }

      const client = await getClient();

      // Attempt a real hard DELETE first — works for vehicles that have no
      // related bookings or other FK-dependent records.
      const hardDelete = await client
        .from(TABLE_NAME)
        .delete()
        .eq('id', id);

      if (hardDelete.error) {
        const isFK = hardDelete.error.code === '23503'
          || String(hardDelete.error.message || '').toLowerCase().includes('foreign key')
          || String(hardDelete.error.message || '').toLowerCase().includes('violates');

        if (!isFK) {
          throw new Error(hardDelete.error.message || `Vehicle ${id} deletion failed.`);
        }

        // FK constraint exists (vehicle has linked bookings) — fall back to
        // soft-delete. Try each status value until the DB accepts one.
        const softStatuses = ['maintenance', 'available'];
        let softError = null;

        for (const s of softStatuses) {
          const attempt = await client
            .from(TABLE_NAME)
            .update({ available: false, is_active: false, status: s })
            .eq('id', id);

          if (!attempt.error) { softError = null; break; }
          softError = attempt.error;
        }

        // Last resort: update only the boolean flags (no status change).
        if (softError) {
          const last = await client
            .from(TABLE_NAME)
            .update({ available: false, is_active: false })
            .eq('id', id);
          if (last.error) {
            throw new Error(last.error.message || `Vehicle ${id} deletion failed.`);
          }
        }
      }

      // Remove from the local in-memory list immediately so the UI updates
      // without waiting for a DB round-trip.
      const index = data.vehicles.findIndex((vehicle) => vehicle.id === id);
      const [deleted] = index >= 0 ? data.vehicles.splice(index, 1) : [{ id }];
      invalidateCache();
      return deleted || { id };
    },
  };
}
