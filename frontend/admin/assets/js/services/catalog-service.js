export function createCatalogService({ data }) {
  return {
    async saveVehicle(vehicleInput, id) {
      if (!vehicleInput || typeof vehicleInput !== 'object') {
        throw new Error('Vehicle payload is required.');
      }

      const normalized = {
        ...vehicleInput,
        daily: Number(vehicleInput.daily),
        weekly: Number(vehicleInput.weekly),
        seasonal: Number(vehicleInput.seasonal),
      };

      if (id) {
        const index = data.vehicles.findIndex((vehicle) => vehicle.id === id);
        if (index < 0) {
          throw new Error(`Vehicle ${id} was not found.`);
        }

        const updated = {
          ...data.vehicles[index],
          ...normalized,
          id,
        };
        data.vehicles.splice(index, 1);
        data.vehicles.unshift(updated);

        return updated;
      }

      const generatedId = `V-${Math.floor(100 + Math.random() * 900)}`;
      const created = {
        id: generatedId,
        ...normalized,
      };
      data.vehicles.unshift(created);
      return created;
    },

    async deleteVehicle(id) {
      if (!id) {
        throw new Error('Vehicle id is required.');
      }

      const index = data.vehicles.findIndex((vehicle) => vehicle.id === id);
      if (index < 0) {
        throw new Error(`Vehicle ${id} was not found.`);
      }

      const [deleted] = data.vehicles.splice(index, 1);
      return deleted;
    },
  };
}
