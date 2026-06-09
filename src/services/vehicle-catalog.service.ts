import supabase from '@/lib/supabase';

export function toSlug(brand: string, name: string): string {
  return `${brand || ''}-${name || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const CACHE_TTL = 60_000;

interface Vehicle {
  id: string;
  name: string;
  brand: string;
  model: string;
  year: number | null;
  type: string;
  category: string;
  pricePerDay: number;
  dailyRate: number;
  description: string;
  features: any[];
  what_is_included: any[];
  specifications: any;
  imageUrl: string;
  images: any[];
  status: string;
  seats: number | null;
  transmission: string;
  fuelType: string;
  mileage: string;
  rating: number;
  reviewCount: number;
  plateNumber: string;
  color: string;
  createdAt: string | null;
}

let vehicleCache: { data: Vehicle[] | null; ts: number } = { data: null, ts: 0 };

function normalizeVehicle(row: any): Vehicle | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || row.vehicle_name || 'Unnamed Vehicle',
    brand: row.brand || row.vehicle_brand || '',
    model: row.model || row.vehicle_model || '',
    year: row.year || row.vehicle_year || null,
    type: row.type || row.vehicle_type || row.category || '',
    category: row.category || row.type || '',
    pricePerDay: Number(row.price_per_day || row.pricePerDay || row.daily_rate || 0),
    dailyRate: Number(row.price_per_day || row.daily_rate || 0),
    description: row.description || '',
    features: row.features || [],
    what_is_included: row.what_is_included || [],
    specifications: row.specifications || row.specs || {},
    imageUrl: row.image_url || row.imageUrl || row.primary_image_url || '',
    images: row.images || row.gallery_images || [],
    status: row.status || 'available',
    seats: row.seats || row.seating_capacity || null,
    transmission: row.transmission || '',
    fuelType: row.fuel_type || row.fuelType || '',
    mileage: row.mileage || '',
    rating: row.rating || row.average_rating || 0,
    reviewCount: row.review_count || row.reviewCount || 0,
    plateNumber: row.plate_number || row.plateNumber || '',
    color: row.color || '',
    createdAt: row.created_at || null,
  };
}

export async function listVehicles({ forceRefresh = false }: { forceRefresh?: boolean } = {}): Promise<Vehicle[]> {
  if (!forceRefresh && vehicleCache.data && Date.now() - vehicleCache.ts < CACHE_TTL) {
    return vehicleCache.data;
  }

  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .in('status', ['available'])
    .order('created_at', { ascending: false });

  if (error) throw error;
  const vehicles = (data || []).map(normalizeVehicle).filter((v): v is Vehicle => v !== null);
  vehicleCache = { data: vehicles, ts: Date.now() };
  return vehicles;
}

export async function getVehicleById(id: string): Promise<Vehicle | null> {
  if (!id) return null;
  const { data, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return normalizeVehicle(data);
}

export async function getVehicleBySlug(slug: string): Promise<Vehicle | null> {
  if (!slug) return null;
  const vehicles = await listVehicles();
  return vehicles.find((v) => toSlug(v.brand, v.name) === slug) || null;
}

export async function getVehicleImages(vehicleId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('vehicle_images')
    .select('*')
    .eq('vehicle_id', vehicleId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data || [];
}

export function invalidateCache(): void {
  vehicleCache = { data: null, ts: 0 };
}
