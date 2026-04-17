export function createCatalogService({ data }) {
  const TABLE_NAME = 'vehicles';
  let clientPromise;

  const toLocalVehicle = (row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    seats: Number(row.seats || 5),
    fuel_type: row.fuel_type,
    status: row.status,
    primary_image_url: row.primary_image_url,
    category: row.category,
    transmission: row.transmission,
    rating: Number(row.rating || 4.6),
    location: row.location,
    available: row.available,
    is_active: row.is_active,
    brand: row.brand,
    price_per_day: Number(row.price_per_day || 0),
    daily: Number(row.price_per_day || 0),
    weekly: 0,
    seasonal: 0,
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

  async function loadVehiclesFromDatabase() {
    const client = await getClient();
    const { data: rows, error } = await client
      .from(TABLE_NAME)
      .select('id,name,type,seats,price_per_day,fuel_type,status,primary_image_url,category,transmission,rating,location,available,is_active,brand,image_url')
      .order('updated_at', { ascending: false });

    if (error) {
      const fallback = await client
        .from(TABLE_NAME)
        .select('id,name,type,seats,price_per_day,fuel_type,status,primary_image_url,category,transmission,rating,location,available,is_active,brand,image_url')
        .order('id', { ascending: true });

      if (fallback.error) {
        throw new Error(fallback.error.message || 'Failed to load vehicles from database.');
      }

      return (fallback.data || []).map(toLocalVehicle);
    }

    return (rows || []).map(toLocalVehicle);
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

      const normalized = {
        name: vehicleInput.name,
        type: vehicleInput.type,
        seats: Number(vehicleInput.seats),
        price_per_day: Number(vehicleInput.price_per_day),
        fuel_type: vehicleInput.fuel_type,
        status: String(vehicleInput.status || '').toLowerCase(),
        primary_image_url: vehicleInput.primary_image_url,
        category: vehicleInput.category,
        transmission: vehicleInput.transmission,
        rating: Number(vehicleInput.rating),
        location: vehicleInput.location,
        available: Boolean(vehicleInput.available),
        is_active: Boolean(vehicleInput.is_active),
        brand: vehicleInput.brand,
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
      return created;
    },

    async deleteVehicle(id) {
      if (!id) {
        throw new Error('Vehicle id is required.');
      }

      const client = await getClient();
      const { error } = await client
        .from(TABLE_NAME)
        .update({
          status: 'inactive',
          available: false,
          is_active: false,
        })
        .eq('id', id);

      if (error) {
        throw new Error(error.message || `Vehicle ${id} soft deletion failed.`);
      }

      const index = data.vehicles.findIndex((vehicle) => vehicle.id === id);
      if (index < 0) return { id };

      const [deleted] = data.vehicles.splice(index, 1);
      return deleted || { id };
    },
  };
}
