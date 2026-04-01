export function createCatalogService({ data }) {
  const TABLE_NAME = 'vehicles';
  let clientPromise;

  const toLocalVehicle = (row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    status: row.status,
    daily: Number(row.daily || 0),
    weekly: Number(row.weekly || 0),
    seasonal: Number(row.seasonal || 0),
    image: row.image || 'https://images.unsplash.com/photo-1493238792000-8113da705763?auto=format&fit=crop&w=640&q=80',
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
      .select('id,name,category,status,daily,weekly,seasonal,image')
      .order('updated_at', { ascending: false });

    if (error) {
      const fallback = await client
        .from(TABLE_NAME)
        .select('id,name,category,status,daily,weekly,seasonal,image')
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
        id,
        name: vehicleInput.name,
        category: vehicleInput.category,
        status: vehicleInput.status,
        daily: Number(vehicleInput.daily),
        weekly: Number(vehicleInput.weekly),
        seasonal: Number(vehicleInput.seasonal),
        image: vehicleInput.image,
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

      const generatedId = `V-${Math.floor(100 + Math.random() * 900)}`;
      const record = {
        ...normalized,
        id: generatedId,
      };

      const { error } = await client.from(TABLE_NAME).insert(record);
      if (error) {
        throw new Error(error.message || 'Vehicle creation failed.');
      }

      const created = toLocalVehicle(record);
      data.vehicles.unshift(created);
      return created;
    },

    async deleteVehicle(id) {
      if (!id) {
        throw new Error('Vehicle id is required.');
      }

      const client = await getClient();
      const { error } = await client.from(TABLE_NAME).delete().eq('id', id);
      if (error) {
        throw new Error(error.message || `Vehicle ${id} deletion failed.`);
      }

      const index = data.vehicles.findIndex((vehicle) => vehicle.id === id);
      if (index < 0) return { id };

      const [deleted] = data.vehicles.splice(index, 1);
      return deleted;
    },
  };
}
