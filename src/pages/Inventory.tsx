// src/pages/Inventory.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import { useBusiness } from '../context/BusinessContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Package, Search, Plus, Filter, ArrowUpRight, 
  Warehouse, AlertCircle, Trash2, Edit2, History,
  ChevronRight, Box, Tag, Truck, LucideIcon, X, TrendingUp
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatBDT } from '../lib/utils';
import { logActivity } from '../lib/activity';
import { InventoryItem } from '../types';
import { useScrollLock } from '../hooks/useScrollLock';

export default function Inventory() {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'add'>('list');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<InventoryItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  useScrollLock(isEditModalOpen || isPurchaseModalOpen || !!itemToDelete);

  // Fetch Inventory
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', business?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('business_id', business?.id)
        .order('name');
      if (error) throw error;
      return data as InventoryItem[];
    },
    enabled: !!business?.id,
  });

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-4 px-0.5">
        <AnimatePresence mode="wait">
          {view === 'list' ? (
            <motion.div 
              key="list"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-4"
            >
              {/* Header Section */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl lg:text-3xl font-bold text-slate-900 tracking-tight uppercase">Product Hub</h1>
                  <p className="text-slate-500 text-[10px] lg:text-xs font-medium">Manage your products and stock movements.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => business ? setView('add') : navigate('/onboarding')}
                    className="flex-1 md:flex-none px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-100"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
                <StatCard title="Total Skus" value={items.length} icon={Box} color="text-blue-600" />
                <StatCard title="Total Stock" value={items.reduce((acc, i) => acc + i.current_stock, 0)} icon={Warehouse} color="text-emerald-600" />
                <StatCard title="Asset (Cost)" value={formatBDT(items.reduce((acc, i) => acc + (i.current_stock * (i.last_landed_cost_cents || 0)), 0))} icon={Tag} color="text-orange-500" />
                <StatCard title="Retail Value" value={formatBDT(items.reduce((acc, i) => acc + (i.current_stock * (i.default_selling_price_cents || 0)), 0))} icon={TrendingUp} color="text-blue-500" />
              </div>

              {/* Search & Filter */}
              {!business && (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-amber-600 shrink-0">
                    <AlertCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-900">Business Setup Required</h3>
                    <p className="text-xs font-medium text-amber-700 mt-1 leading-relaxed">
                      Connect or create a business to start managing your inventory. You are currently viewing the app in demo mode.
                    </p>
                    <button 
                      onClick={() => navigate('/onboarding')}
                      className="mt-3 text-[10px] font-bold text-amber-900 uppercase tracking-widest underline underline-offset-4"
                    >
                      Go to Onboarding
                    </button>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-3 bg-white p-2.5 rounded-2xl border border-slate-100 shadow-sm">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input 
                    className="w-full bg-slate-50 border border-slate-50 h-9 pl-9 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-xs font-medium"
                    placeholder="Search by name or SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button className="p-2 bg-slate-50 text-slate-400 rounded-lg hover:text-slate-600 transition-colors">
                  <Filter className="w-4 h-4" />
                </button>
              </div>

              {/* Items List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredItems.map(item => (
                  <ItemCard 
                    key={item.id} 
                    item={item} 
                    onAddStock={() => { setSelectedItem(item); setIsPurchaseModalOpen(true); }}
                    onEdit={() => { setSelectedItem(item); setIsEditModalOpen(true); }}
                    onDelete={() => setItemToDelete(item)}
                  />
                ))}
                {filteredItems.length === 0 && !isLoading && (
                  <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                    <Package className="w-16 h-16 mb-4 opacity-10" />
                    <p className="text-xs font-bold uppercase tracking-widest">No items found</p>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <AddItemView onBack={() => setView('list')} items={items} />
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isEditModalOpen && selectedItem && (
          <EditItemModal 
            item={selectedItem} 
            onClose={() => { setIsEditModalOpen(false); setSelectedItem(null); }} 
          />
        )}
        {isPurchaseModalOpen && selectedItem && (
          <AddPurchaseModal 
            item={selectedItem} 
            onClose={() => { setIsPurchaseModalOpen(false); setSelectedItem(null); }} 
          />
        )}
        {itemToDelete && (
          <DeleteConfirmModal 
            item={itemToDelete} 
            onClose={() => setItemToDelete(null)} 
          />
        )}
      </AnimatePresence>
    </MainLayout>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <div className="bg-white p-3 lg:p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 lg:gap-3">
      <div className="w-8 h-8 lg:w-9 lg:h-9 bg-slate-50 rounded-xl flex items-center justify-center">
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-[8px] lg:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{title}</p>
        <p className="text-sm lg:text-base font-bold text-slate-900 tracking-tight leading-none">{value}</p>
      </div>
    </div>
  );
}

function ItemCard({ item, onAddStock, onEdit, onDelete }: { item: InventoryItem, onAddStock: () => void, onEdit: () => void, onDelete: () => void }) {
  const isLow = item.current_stock <= item.low_stock_threshold;
  return (
    <motion.div 
      layout
      className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all group flex flex-col active:scale-95 cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
            <Package className="w-3.5 h-3.5" />
          </div>
          <div className="text-left">
            <h3 className="text-xs lg:text-sm font-semibold text-slate-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight truncate max-w-[140px]">{item.name}</h3>
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{item.sku}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-sm lg:text-base font-bold tracking-tight ${isLow ? 'text-red-500' : 'text-slate-900'}`}>
            {item.current_stock} <span className="text-[8px] text-slate-400 font-bold ml-0.5 uppercase tracking-widest">{item.unit}</span>
          </p>
          {isLow && (
            <span className="inline-flex px-1.5 py-0.5 bg-red-100 text-red-600 rounded text-[7px] font-black uppercase tracking-tighter mt-1">
              Low Stock
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50/50 rounded-2xl mb-2 border border-slate-100/50">
        <div className="flex flex-col text-left px-1">
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Buy Price</span>
          <p className="text-xs font-bold text-slate-900">{formatBDT(item.last_landed_cost_cents || 0)}</p>
        </div>
        <div className="flex flex-col border-l border-slate-200 pl-3">
          <span className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mb-1">Sell Price</span>
          <p className="text-xs font-bold text-emerald-600">{formatBDT(item.default_selling_price_cents || 0)}</p>
        </div>
      </div>

      <div className="mt-auto pt-2 border-t border-slate-50 flex items-center justify-between">
        <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest">Controls</span>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onAddStock(); }}
            className="px-2.5 py-1.5 bg-blue-50 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-blue-100 transition-all text-blue-600 active:scale-95 shadow-sm shadow-blue-50"
          >
            <Truck className="w-3 h-3" /> Restock
          </button>
          <div className="flex gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className="p-2 bg-slate-50 text-slate-400 rounded-xl hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 bg-red-50 text-red-400 rounded-xl hover:text-red-600 hover:bg-red-100 transition-all active:scale-95"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Edit Item Modal
function EditItemModal({ item, onClose }: { item: InventoryItem, onClose: () => void }) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  
  // Fetch the latest purchase transaction to pre-fill the cost breakdown
  const { data: latestPurchase } = useQuery({
    queryKey: ['latest-purchase', item.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_transactions')
        .select('*')
        .eq('item_id', item.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows found
      return data;
    },
    enabled: !!item.id
  });

  const [formData, setFormData] = useState({
    name: item.name,
    category: item.category || '',
    sku: item.sku,
    threshold: item.low_stock_threshold.toString(),
    sellingPrice: ((item.default_selling_price_cents || 0) / 100).toString(),
    unit: item.unit || 'pcs',
    currentStock: item.current_stock.toString(),
    lastLandedCost: ((item.last_landed_cost_cents || 0) / 100).toString(),
    unitWeight: (item.weight_per_unit || 0).toString(),
    weightPerUnit: (item.weight_per_unit || 0).toString(),
    supplier: item.supplier || '',
    description: item.description || '',
    // Breakdown fields
    quantity: item.current_stock.toString(),
    unitBuyingRmb: '0',
    totalBuyingRmb: '0',
    exchangeRate: business?.exchange_rate?.toString() || '18.15',
    shippingMethod: 'SEA',
    shippingRate: '0',
    additionalCost: '0',
    additionalCostCurrency: 'BDT' as 'BDT' | 'RMB',
    totalWeight: '0'
  });

  // Update breakdown fields when latestPurchase is loaded
  React.useEffect(() => {
    if (latestPurchase) {
      const q = latestPurchase.quantity || 1;
      const tRmb = (latestPurchase.buying_cost_per_unit_rmb_cents || 0) * q / 100;
      const uRmb = (latestPurchase.buying_cost_per_unit_rmb_cents || 0) / 100;
      setFormData(prev => ({
        ...prev,
        unitBuyingRmb: uRmb.toString(),
        totalBuyingRmb: tRmb.toString(),
        exchangeRate: (latestPurchase.exchange_rate_used || 0).toString(),
        shippingMethod: latestPurchase.shipping_method || 'SEA',
        shippingRate: ((latestPurchase.shipping_rate_bdt_per_kg_cents || 0) / 100).toString(),
        additionalCost: ((latestPurchase.additional_cost_bdt_cents || 0) / (latestPurchase.additional_cost_currency === 'RMB' ? latestPurchase.exchange_rate_used || 1 : 1) / 100).toString(),
        additionalCostCurrency: (latestPurchase.additional_cost_currency || 'BDT') as 'BDT' | 'RMB',
        unitWeight: (item.weight_per_unit || 0).toString(),
        totalWeight: ((item.weight_per_unit || 0) * q).toString(),
        quantity: q.toString()
      }));
    }
  }, [latestPurchase, item.weight_per_unit]);

  const handleQuantityChange = (v: string) => {
    const qty = parseFloat(v) || 0;
    const uWeight = parseFloat(formData.unitWeight) || 0;
    const uRmb = parseFloat(formData.unitBuyingRmb) || 0;
    setFormData({
      ...formData,
      quantity: v,
      totalWeight: (qty * uWeight).toFixed(3),
      totalBuyingRmb: (qty * uRmb).toFixed(2)
    });
  };

  const handleUnitWeightChange = (v: string) => {
    const uWeight = parseFloat(v) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({
      ...formData,
      unitWeight: v,
      totalWeight: (qty * uWeight).toFixed(3)
    });
  };

  const handleTotalWeightChange = (v: string) => {
    const tWeight = parseFloat(v) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({
      ...formData,
      totalWeight: v,
      unitWeight: qty > 0 ? (tWeight / qty).toFixed(3) : '0.000'
    });
  };

  const handleUnitBuyingRmbChange = (v: string) => {
    const uRmb = parseFloat(v) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({
      ...formData,
      unitBuyingRmb: v,
      totalBuyingRmb: (qty * uRmb).toFixed(2)
    });
  };

  const handleTotalBuyingRmbChange = (v: string) => {
    const tRmb = parseFloat(v) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({
      ...formData,
      totalBuyingRmb: v,
      unitBuyingRmb: qty > 0 ? (tRmb / qty).toFixed(2) : '0.00'
    });
  };

  const editQty = parseInt(formData.quantity) || 0;
  const weight = parseFloat(formData.totalWeight) || 0;
  const rate = parseFloat(formData.exchangeRate) || 0;
  const totalRmb = parseFloat(formData.totalBuyingRmb) || 0;
  const shipRate = parseFloat(formData.shippingRate) || 0;
  const addCost = parseFloat(formData.additionalCost) || 0;

  const totalBuyingBDT = totalRmb * rate;
  const totalShippingBDT = weight * shipRate;
  const addCostBDT = formData.additionalCostCurrency === 'RMB' ? addCost * rate : addCost;
  const totalLandedCostBDT = totalBuyingBDT + totalShippingBDT + addCostBDT;
  const calculatedLandedCostPerUnit = editQty > 0 ? totalLandedCostBDT / editQty : 0;

  const mutation = useMutation({
    mutationFn: async () => {
      const updatedLandedCost = Math.round(calculatedLandedCostPerUnit * 100);
      const { error } = await supabase
        .from('inventory_items')
        .update({
          name: formData.name,
          category: formData.category,
          sku: formData.sku,
          low_stock_threshold: parseInt(formData.threshold) || 0,
          default_selling_price_cents: Math.round(parseFloat(formData.sellingPrice || '0') * 100),
          unit: formData.unit,
          current_stock: parseInt(formData.currentStock) || 0,
          last_landed_cost_cents: updatedLandedCost > 0 ? updatedLandedCost : Math.round(parseFloat(formData.lastLandedCost || '0') * 100),
          weight_per_unit: weight > 0 && editQty > 0 ? weight / editQty : parseFloat(formData.weightPerUnit || '0'),
          supplier: formData.supplier,
          description: formData.description
        })
        .eq('id', item.id);
      
      if (error) throw error;

      // If they changed the cost breakdown, we might want to update the latest purchase too
      if (latestPurchase && (totalRmb > 0 || addCost > 0)) {
        await supabase
          .from('purchase_transactions')
          .update({
            quantity: editQty,
            buying_cost_per_unit_rmb_cents: Math.round((editQty > 0 ? totalRmb / editQty : 0) * 100),
            exchange_rate_used: rate,
            shipping_method: formData.shippingMethod,
            shipping_rate_bdt_per_kg_cents: Math.round(shipRate * 100),
            additional_cost_bdt_cents: Math.round(addCostBDT * 100),
            landed_cost_per_unit_bdt_cents: updatedLandedCost,
            total_landed_cost_bdt_cents: Math.round(totalLandedCostBDT * 100)
          })
          .eq('id', latestPurchase.id);
      }

      const { user } = (await supabase.auth.getUser()).data;
      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'EDIT_ITEM',
        details: {
          title: `Updated: ${formData.name}`,
          sub: `SKU: ${formData.sku}`,
          amount: 'EDITED',
          type: 'inventory'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl relative overflow-hidden z-10 my-8"
      >
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Edit Item</h2>
            <p className="text-xs text-slate-400 font-medium">Full inventory record management</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Section 1: General Info */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">General Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <Input label="Item Name" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} />
              <Input label="Category" value={formData.category} onChange={(v: string) => setFormData({...formData, category: v})} />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
              <Input label="SKU" value={formData.sku} onChange={(v: string) => setFormData({...formData, sku: v})} />
              <Input label="Unit" value={formData.unit} onChange={(v: string) => setFormData({...formData, unit: v})} />
              <Input label="Current Stock" type="number" value={formData.currentStock} onChange={(v: string) => setFormData({...formData, currentStock: v})} />
              <Input label="Alert Threshold" type="number" value={formData.threshold} onChange={(v: string) => setFormData({...formData, threshold: v})} />
            </div>
          </div>

          {/* Section 2: Costing Breakdown (Mirroring Add Product) */}
          <div className="space-y-4 border-t border-slate-50 pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-600">Calculated Costing Breakdown</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Recalculates Landed Cost</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <FormRow label="Batch Quantity" type="number" value={formData.quantity} onChange={handleQuantityChange} />
              <FormRow label="Unit Weight (kg)" type="number" step="0.001" value={formData.unitWeight} onChange={handleUnitWeightChange} />
              <FormRow label="Batch Weight (kg)" type="number" step="0.01" value={formData.totalWeight} onChange={handleTotalWeightChange} />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
              <FormRow label="Buying Cost (RMB Total)" type="number" value={formData.totalBuyingRmb} onChange={handleTotalBuyingRmbChange} />
              <FormRow label="Unit Cost (RMB)" type="number" value={formData.unitBuyingRmb} onChange={handleUnitBuyingRmbChange} />
              <FormRow label="Daily RMB Rate" type="number" value={formData.exchangeRate} onChange={(v: string) => setFormData({...formData, exchangeRate: v})} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Shipping Method</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 font-bold h-11">
                  {['SEA', 'AIR', 'LUGGAGE'].map(m => (
                    <button 
                      key={m} 
                      type="button"
                      onClick={() => setFormData({...formData, shippingMethod: m})} 
                      className={`flex-1 flex items-center justify-center rounded-lg text-[9px] uppercase transition-all ${formData.shippingMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <FormRow label="Shipping Rate (BDT/kg)" type="number" value={formData.shippingRate} onChange={(v: string) => setFormData({...formData, shippingRate: v})} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <FormRow label="Selling Price (BDT Unit)" type="number" value={formData.sellingPrice} onChange={(v: string) => setFormData({...formData, sellingPrice: v})} />
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Other Costs</label>
                <div className="flex gap-2">
                  <input 
                    type="number"
                    className="w-full bg-slate-50 border border-slate-100 h-11 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                    value={formData.additionalCost}
                    onChange={(e) => setFormData({...formData, additionalCost: e.target.value})}
                  />
                  <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 font-bold h-11">
                    {['BDT', 'RMB'].map(c => (
                      <button 
                        key={c} 
                        type="button"
                        onClick={() => setFormData({...formData, additionalCostCurrency: c as any})} 
                        className={`px-3 flex items-center justify-center rounded-lg text-[9px] uppercase transition-all ${formData.additionalCostCurrency === c ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Box */}
            <div className="p-4 bg-slate-900 rounded-2xl text-white flex items-center justify-between">
               <div className="flex items-center gap-4">
                 <div className="p-2 bg-white/10 rounded-xl">
                   <TrendingUp className="w-4 h-4 text-blue-400" />
                 </div>
                 <div>
                   <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none">New Landed Cost Per Unit</p>
                   <p className="text-xl font-bold font-mono">৳{calculatedLandedCostPerUnit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                 </div>
               </div>
               <div className="text-right">
                 <p className="text-[9px] font-bold text-white/40 uppercase tracking-widest leading-none">Original Landed Cost</p>
                 <p className="text-sm font-bold text-slate-400">৳{((item.last_landed_cost_cents || 0) / 100).toLocaleString()}</p>
               </div>
            </div>
          </div>

          {/* Section 3: Logistics & Meta */}
          <div className="space-y-4 border-t border-slate-50 pt-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Supplier & Logistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
              <FormRow label="Supplier Name" value={formData.supplier} onChange={(v: string) => setFormData({...formData, supplier: v})} />
              <FormRow label="Weight/Unit (Calculated)" type="number" value={(weight > 0 && editQty > 0 ? weight / editQty : parseFloat(formData.weightPerUnit || '0')).toFixed(3)} readOnly />
            </div>
            <div className="space-y-1.5 text-left pt-2">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Description</label>
              <textarea 
                 className="w-full bg-slate-50 border border-slate-100 p-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium min-h-[80px]"
                 value={formData.description}
                 onChange={(e) => setFormData({...formData, description: e.target.value})}
                 placeholder="Enter item description..."
              />
            </div>
          </div>
        </div>
        <div className="p-6 bg-slate-50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95">Cancel</button>
          <button 
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-[2] py-3 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-95"
          >
            {mutation.isPending ? 'Updating...' : 'Save All Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Add Item View (Full Page Integrated)
function AddItemView({ onBack, items }: { onBack: () => void, items: InventoryItem[] }) {
  const { business, refreshBusiness } = useBusiness();
  const queryClient = useQueryClient();
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '0',
    unitWeight: '0.000',
    totalWeight: '0.00',
    threshold: '5',
    unitBuyingRmb: '0.00',
    totalBuyingRmb: '0.00',
    rmbRate: business?.exchange_rate?.toString() || '18.15',
    shippingMethod: 'SEA',
    shippingRate: '0.00',
    additionalCost: '0.00',
    additionalCostCurrency: 'BDT' as 'BDT' | 'RMB',
    sellingPrice: '0.00'
  });

  const handleQuantityChange = (v: string) => {
    const qty = parseFloat(v) || 0;
    const uWeight = parseFloat(formData.unitWeight) || 0;
    const uRmb = parseFloat(formData.unitBuyingRmb) || 0;
    setFormData({
      ...formData,
      quantity: v,
      totalWeight: (qty * uWeight).toFixed(3),
      totalBuyingRmb: (qty * uRmb).toFixed(2)
    });
  };

  const handleUnitWeightChange = (v: string) => {
    const uWeight = parseFloat(v) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({
      ...formData,
      unitWeight: v,
      totalWeight: (qty * uWeight).toFixed(3)
    });
  };

  const handleTotalWeightChange = (v: string) => {
    const tWeight = parseFloat(v) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({
      ...formData,
      totalWeight: v,
      unitWeight: qty > 0 ? (tWeight / qty).toFixed(3) : '0.000'
    });
  };

  const handleUnitBuyingRmbChange = (v: string) => {
    const uRmb = parseFloat(v) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({
      ...formData,
      unitBuyingRmb: v,
      totalBuyingRmb: (qty * uRmb).toFixed(2)
    });
  };

  const handleTotalBuyingRmbChange = (v: string) => {
    const tRmb = parseFloat(v) || 0;
    const qty = parseFloat(formData.quantity) || 0;
    setFormData({
      ...formData,
      totalBuyingRmb: v,
      unitBuyingRmb: qty > 0 ? (tRmb / qty).toFixed(2) : '0.00'
    });
  };

  // Balance Check Logic
  const { data: balances } = useQuery({
    queryKey: ['wallet-balances', business?.id],
    queryFn: async () => {
      if (!business?.id) return { bdt: 0, rmb: 0 };
      
      const [
        { data: sales },
        { data: expenses },
        { data: capital },
        { data: distribution },
        { data: internalExchanges },
        { data: ledger },
        { data: purchases }
      ] = await Promise.all([
        supabase.from('sales').select('received_now_bdt_cents').eq('business_id', business.id),
        supabase.from('expenses').select('amount_cents, currency').eq('business_id', business.id),
        supabase.from('capital_contributions').select('amount, currency').eq('business_id', business.id),
        supabase.from('partner_profit_distributions').select('amount_cents').eq('business_id', business.id),
        supabase.from('exchanges').select('*').eq('business_id', business.id),
        supabase.from('customer_ledger').select('amount_cents, transaction_type').eq('business_id', business.id),
        supabase.from('purchase_transactions').select('total_landed_cost_bdt_cents, buying_cost_per_unit_rmb_cents, quantity, exchange_rate_used, paid, additional_cost_bdt_cents, additional_cost_currency').eq('business_id', business.id).eq('paid', true)
      ]);

      let bdt = 0;
      let rmb = 0;

      // Income
      sales?.forEach(s => bdt += (s.received_now_bdt_cents || 0));
      ledger?.forEach(l => {
        if (l.transaction_type === 'payment') bdt += (l.amount_cents || 0);
        else if (l.transaction_type === 'return') bdt -= (l.amount_cents || 0);
      });
      capital?.forEach(c => {
        const amtCents = Math.round(parseFloat(c.amount || '0') * 100);
        if (c.currency === 'BDT') bdt += amtCents;
        else rmb += amtCents;
      });

      // Reductions
      distribution?.forEach(d => bdt -= (d.amount_cents || 0));
      expenses?.forEach(e => {
        if (e.currency === 'BDT') bdt -= (e.amount_cents || 0);
        else rmb -= (e.amount_cents || 0);
      });
      purchases?.forEach(p => {
        const pRmbCents = (p.buying_cost_per_unit_rmb_cents || 0) * (p.quantity || 0);
        rmb -= pRmbCents;
        const addCostBDTCents = p.additional_cost_bdt_cents || 0;
        if (p.additional_cost_currency === 'RMB') {
          rmb -= Math.round(addCostBDTCents / (p.exchange_rate_used || 1));
        } else {
          bdt -= addCostBDTCents;
        }
        const pBDTCents = Math.round(pRmbCents * (p.exchange_rate_used || 1));
        const shippingBDTCents = (p.total_landed_cost_bdt_cents || 0) - pBDTCents - addCostBDTCents;
        bdt -= Math.max(0, shippingBDTCents);
      });

      // Exchanges
      internalExchanges?.forEach((ex: any) => {
        if (ex.from_currency === 'BDT') {
          bdt -= ex.amount_from_cents;
          rmb += ex.amount_to_cents;
        } else {
          rmb -= ex.amount_from_cents;
          bdt += ex.amount_to_cents;
        }
      });

      return { bdt: bdt / 100, rmb: rmb / 100 };
    },
    enabled: !!business?.id
  });

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean))) as string[];
  const filteredCategories = categories.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));

  const qty = parseInt(formData.quantity) || 0;
  const weight = parseFloat(formData.totalWeight) || 0;
  const rate = parseFloat(formData.rmbRate) || 0;
  const totalRmb = parseFloat(formData.totalBuyingRmb) || 0;
  const shipRate = parseFloat(formData.shippingRate) || 0;
  const addCost = parseFloat(formData.additionalCost) || 0;
  const sellPrice = parseFloat(formData.sellingPrice) || 0;

  const totalBuyingBDT = totalRmb * rate;
  const totalShippingBDT = weight * shipRate;
  const addCostBDT = formData.additionalCostCurrency === 'RMB' ? addCost * rate : addCost;
  const totalLandedCostBDT = totalBuyingBDT + totalShippingBDT + addCostBDT;
  const landedCostPerUnit = qty > 0 ? totalLandedCostBDT / qty : 0;
  const potentialProfit = (sellPrice * qty) - totalLandedCostBDT;
  const profitMargin = totalLandedCostBDT > 0 ? (potentialProfit / totalLandedCostBDT) * 100 : 0;

  // Insufficient Balance Checks
  const requiredRMB = totalRmb + (formData.additionalCostCurrency === 'RMB' ? addCost : 0);
  const requiredBDT = totalShippingBDT + (formData.additionalCostCurrency === 'BDT' ? addCost : 0);
  
  const isRMBInsufficient = requiredRMB > (balances?.rmb || 0);
  const isBDTInsufficient = requiredBDT > (balances?.bdt || 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!business) return;
      
      if (isRMBInsufficient) throw new Error(`Insufficient RMB balance. Available: ${balances?.rmb}`);
      if (isBDTInsufficient) throw new Error(`Insufficient BDT balance. Available: ${balances?.bdt}`);

      const sku = `SKU-${Date.now().toString().slice(-6)}`;
      const { data: item, error: itemError } = await supabase.from('inventory_items').insert({
        business_id: business.id,
        name: formData.name,
        category: formData.category,
        sku,
        current_stock: qty,
        low_stock_threshold: parseInt(formData.threshold),
        default_selling_price_cents: Math.round(sellPrice * 100),
        last_landed_cost_cents: Math.round(landedCostPerUnit * 100),
        weight_per_unit: qty > 0 ? weight / qty : 0
      }).select().single();

      if (itemError) throw itemError;

      const { error: pError } = await supabase.from('purchase_transactions').insert({
        business_id: business.id,
        item_id: item.id,
        quantity: qty,
        buying_cost_per_unit_rmb_cents: Math.round((qty > 0 ? totalRmb / qty : 0) * 100),
        exchange_rate_used: rate,
        shipping_method: formData.shippingMethod,
        shipping_rate_bdt_per_kg_cents: Math.round(shipRate * 100),
        additional_cost_bdt_cents: Math.round(addCostBDT * 100),
        additional_cost_currency: formData.additionalCostCurrency,
        landed_cost_per_unit_bdt_cents: Math.round(landedCostPerUnit * 100),
        total_landed_cost_bdt_cents: Math.round(totalLandedCostBDT * 100),
        paid: true 
      });

      if (pError) throw pError;

      const { user } = (await supabase.auth.getUser()).data;
      await logActivity({
        business_id: business.id,
        user_id: user?.id,
        action: 'ADD_ITEM',
        details: {
          title: `New Product: ${formData.name}`,
          sub: `Category: ${formData.category || 'General'}`,
          amount: 'NEW',
          type: 'inventory'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      refreshBusiness?.();
      onBack();
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="w-full"
    >
      <div className="md:px-2">
        <div className="flex items-center justify-between mb-6">
          <button 
            onClick={onBack}
            className="group flex items-center gap-3 text-slate-400 hover:text-slate-900 transition-colors"
          >
            <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4 rotate-45" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-[0.2em]">Exit</span>
          </button>
          <div className="text-right">
             <h2 className="text-lg font-black text-slate-900 tracking-tight">ADD NEW ITEM</h2>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Single Workflow Setup</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left Column: Form Details */}
          <div className="lg:col-span-2 space-y-3">
             <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                   <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                     <Box className="w-3.5 h-3.5" />
                   </div>
                   <h3 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-slate-900">General Information</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormRow label="Item Name" placeholder="e.g. Wireless Headphones" value={formData.name} onChange={(v:any) => setFormData({...formData, name: v})} />
                    
                    {/* Category Searchable Dropdown */}
                    <div className="space-y-1 flex-1 relative text-left">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1 min-h-[14px] flex items-center">Category</label>
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Select Category"
                          className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold text-slate-900 text-sm"
                          value={formData.category}
                          onChange={e => {
                            setFormData({...formData, category: e.target.value});
                            setCategorySearch(e.target.value);
                            setIsCategoryDropdownOpen(true);
                          }}
                          onFocus={() => setIsCategoryDropdownOpen(true)}
                        />
                        {isCategoryDropdownOpen && (categorySearch || filteredCategories.length > 0) && (
                          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                            {filteredCategories.map(cat => (
                              <button 
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setFormData({...formData, category: cat});
                                  setIsCategoryDropdownOpen(false);
                                }}
                                className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                              >
                                {cat}
                              </button>
                            ))}
                            {categorySearch && !categories.includes(categorySearch) && (
                              <button 
                                type="button"
                                onClick={() => setIsCategoryDropdownOpen(false)}
                                className="w-full text-left px-4 py-2.5 text-[10px] font-bold text-blue-600 hover:bg-blue-50"
                              >
                                + Use "{categorySearch}"
                              </button>
                            )}
                          </div>
                        )}
                        {isCategoryDropdownOpen && (
                          <div className="fixed inset-0 z-40" onClick={() => setIsCategoryDropdownOpen(false)} />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <FormRow label="Initial Stock" type="number" value={formData.quantity} onChange={handleQuantityChange} />
                    <FormRow label="Unit Weight" sub="kg" type="number" step="0.001" value={formData.unitWeight} onChange={handleUnitWeightChange} />
                    <FormRow label="Total Weight" sub="kg" type="number" step="0.01" value={formData.totalWeight} onChange={handleTotalWeightChange} />
                    <FormRow label="Alert Threshold" type="number" value={formData.threshold} onChange={(v:any) => setFormData({...formData, threshold: v})} />
                  </div>
                </div>
             </section>
 
             <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-50 flex items-center gap-2">
                   <div className="w-7 h-7 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500">
                     <Truck className="w-3.5 h-3.5" />
                   </div>
                   <h3 className="text-xs lg:text-sm font-bold uppercase tracking-widest text-slate-900">Costing & Logistics</h3>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pb-2 border-b border-slate-50/50">
                    <FormRow label="Buying Cost (RMB Total)" type="number" value={formData.totalBuyingRmb} onChange={handleTotalBuyingRmbChange} />
                    <FormRow label="Unit Cost (RMB)" type="number" value={formData.unitBuyingRmb} onChange={handleUnitBuyingRmbChange} />
                    <FormRow label="Daily RMB Rate" type="number" step="0.01" value={formData.rmbRate} onChange={(v:any) => setFormData({...formData, rmbRate: v})} />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1 text-left">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Shipping Method</label>
                      <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 font-bold h-10">
                        {['SEA', 'AIR', 'LUGGAGE'].map(m => (
                          <button 
                            key={m} 
                            type="button"
                            onClick={() => setFormData({...formData, shippingMethod: m})} 
                            className={`flex-1 flex items-center justify-center rounded-lg text-[8px] tracking-tight uppercase transition-all ${formData.shippingMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                    <FormRow label="Shipping Rate (BDT/kg)" type="number" value={formData.shippingRate} onChange={(v:any) => setFormData({...formData, shippingRate: v})} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1 text-left">
                      <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Other Costs</label>
                      <div className="flex items-center gap-2">
                         <div className="flex-1">
                            <input 
                              type="number"
                              className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-sm"
                              value={formData.additionalCost}
                              onChange={(e) => setFormData({...formData, additionalCost: e.target.value})}
                            />
                         </div>
                         <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 font-bold h-10">
                            {['BDT', 'RMB'].map(c => (
                              <button key={c} type="button" onClick={() => setFormData({...formData, additionalCostCurrency: c as any})} className={`px-3 flex items-center justify-center rounded-lg text-[9px] uppercase transition-all ${formData.additionalCostCurrency === c ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}>{c}</button>
                            ))}
                         </div>
                      </div>
                    </div>
                    <FormRow label="Selling Price (BDT Unit)" type="number" value={formData.sellingPrice} onChange={(v:any) => setFormData({...formData, sellingPrice: v})} />
                  </div>
                </div>
             </section>
          </div>
 
          {/* Right Column: Analysis Sidebar */}
          <div className="space-y-4 text-left">
             <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-5 sticky top-16">
                <div>
                   <div className="flex items-center gap-2 mb-3">
                      <Tag className="w-3.5 h-3.5 text-blue-500" />
                      <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-900">Wallet & Analysis</h3>
                   </div>
                   
                   <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">BDT Hub Balance</span>
                        <span className={`text-xs font-black ${isBDTInsufficient ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>{balances?.bdt?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">RMB Hub Balance</span>
                        <span className={`text-xs font-black ${isRMBInsufficient ? 'text-red-500 animate-pulse' : 'text-slate-900'}`}>{balances?.rmb?.toLocaleString() || '0'}</span>
                      </div>
                      <div className="h-px bg-slate-200 my-2" />
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Unit Landed Cost</span>
                        <span className="text-sm font-black text-blue-600">৳{landedCostPerUnit.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                      </div>
                   </div>
 
                   <div className="space-y-2 mb-4">
                      <SummaryRow2 label="Cost of Goods (RMB)" value={`${totalRmb.toLocaleString()} RMB`} />
                      <SummaryRow2 label="Other Costs" value={`${addCost} ${formData.additionalCostCurrency}`} />
                      <SummaryRow2 label="Landed BDT" value={`৳${totalLandedCostBDT.toLocaleString()}`} total />
                   </div>
 
                   {(isRMBInsufficient || isBDTInsufficient) && (
                     <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 mb-4">
                       <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                       <p className="text-[9px] font-bold text-red-600 uppercase leading-tight">
                         Insufficient funds in {isRMBInsufficient && isBDTInsufficient ? 'both wallets' : isRMBInsufficient ? 'RMB wallet' : 'BDT wallet'}. 
                         Please add capital or exchange currency to continue.
                       </p>
                     </div>
                   )}

                   <div className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-1 ${potentialProfit > 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                      <div className="flex items-center gap-2">
                         <TrendingUp className={`w-3.5 h-3.5 ${potentialProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`} />
                         <span className={`text-[9px] font-black uppercase tracking-widest ${potentialProfit > 0 ? 'text-emerald-700' : 'text-red-700'}`}>Potential Profit</span>
                      </div>
                      <p className={`text-xl font-black tracking-tight ${potentialProfit > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ৳{potentialProfit.toLocaleString()}
                      </p>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${potentialProfit > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {profitMargin.toFixed(1)}% Margin
                      </span>
                   </div>
                </div>
 
                <div className="space-y-2">
                  <button 
                    onClick={() => mutation.mutate()}
                    disabled={mutation.isPending || !formData.name || isRMBInsufficient || isBDTInsufficient}
                    className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {mutation.isPending ? 'Working...' : 'Save Product'}
                  </button>
                  <button 
                    onClick={onBack}
                    className="w-full py-3 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                </div>
             </section>
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// Add Purchase Modal (The Critical Cost Flow)
function AddPurchaseModal({ item, onClose }: { item: InventoryItem, onClose: () => void }) {
  const { business } = useBusiness();
  const queryClient = useQueryClient();
  const [qty, setQty] = useState('');
  const [buyingCostRmb, setBuyingCostRmb] = useState('');
  const [totalCostRmb, setTotalCostRmb] = useState('');
  const [shippingRate, setShippingRate] = useState(''); // BDT per KG
  const [additionalCost, setAdditionalCost] = useState('0');
  const [additionalCostCurrency, setAdditionalCostCurrency] = useState<'BDT' | 'RMB'>('BDT');
  const [exchangeRate, setExchangeRate] = useState(business?.exchange_rate?.toString() || '');
  const [shippingMethod, setShippingMethod] = useState('SEA');
  const [isPaid, setIsPaid] = useState(false);

  const handleQtyChange = (v: string) => {
    setQty(v);
    const q = parseFloat(v) || 0;
    const unitRmb = parseFloat(buyingCostRmb) || 0;
    setTotalCostRmb((q * unitRmb).toFixed(2));
  };

  const handleUnitRmbChange = (v: string) => {
    setBuyingCostRmb(v);
    const unitRmb = parseFloat(v) || 0;
    const q = parseFloat(qty) || 0;
    setTotalCostRmb((q * unitRmb).toFixed(2));
  };

  const handleTotalRmbChange = (v: string) => {
    setTotalCostRmb(v);
    const totalRmb = parseFloat(v) || 0;
    const q = parseFloat(qty) || 0;
    if (q > 0) {
      setBuyingCostRmb((totalRmb / q).toFixed(2));
    }
  };

  // Balance Check Logic
  const { data: balances } = useQuery({
    queryKey: ['wallet-balances', business?.id],
    queryFn: async () => {
      if (!business?.id) return { bdt: 0, rmb: 0 };
      
      const [
        { data: sales },
        { data: expenses },
        { data: capital },
        { data: distribution },
        { data: internalExchanges },
        { data: ledger },
        { data: purchases }
      ] = await Promise.all([
        supabase.from('sales').select('received_now_bdt_cents').eq('business_id', business.id),
        supabase.from('expenses').select('amount_cents, currency').eq('business_id', business.id),
        supabase.from('capital_contributions').select('amount, currency').eq('business_id', business.id),
        supabase.from('partner_profit_distributions').select('amount_cents').eq('business_id', business.id),
        supabase.from('exchanges').select('*').eq('business_id', business.id),
        supabase.from('customer_ledger').select('amount_cents, transaction_type').eq('business_id', business.id),
        supabase.from('purchase_transactions').select('total_landed_cost_bdt_cents, buying_cost_per_unit_rmb_cents, quantity, exchange_rate_used, paid, additional_cost_bdt_cents, additional_cost_currency').eq('business_id', business.id).eq('paid', true)
      ]);

      let bdt = 0;
      let rmb = 0;

      sales?.forEach(s => bdt += (s.received_now_bdt_cents || 0));
      ledger?.forEach(l => {
        if (l.transaction_type === 'payment') bdt += (l.amount_cents || 0);
        else if (l.transaction_type === 'return') bdt -= (l.amount_cents || 0);
      });
      capital?.forEach(c => {
        const amtCents = Math.round(parseFloat(c.amount || '0') * 100);
        if (c.currency === 'BDT') bdt += amtCents;
        else rmb += amtCents;
      });
      distribution?.forEach(d => bdt -= (d.amount_cents || 0));
      expenses?.forEach(e => {
        if (e.currency === 'BDT') bdt -= (e.amount_cents || 0);
        else rmb -= (e.amount_cents || 0);
      });
      purchases?.forEach(p => {
        const pRmbCents = (p.buying_cost_per_unit_rmb_cents || 0) * (p.quantity || 0);
        rmb -= pRmbCents;
        const addCostBDTCents = p.additional_cost_bdt_cents || 0;
        if (p.additional_cost_currency === 'RMB') {
          rmb -= Math.round(addCostBDTCents / (p.exchange_rate_used || 1));
        } else {
          bdt -= addCostBDTCents;
        }
        const pBDTCents = Math.round(pRmbCents * (p.exchange_rate_used || 1));
        const shippingBDTCents = (p.total_landed_cost_bdt_cents || 0) - pBDTCents - addCostBDTCents;
        bdt -= Math.max(0, shippingBDTCents);
      });
      internalExchanges?.forEach((ex: any) => {
        if (ex.from_currency === 'BDT') {
          bdt -= ex.amount_from_cents;
          rmb += ex.amount_to_cents;
        } else {
          rmb -= ex.amount_from_cents;
          bdt += ex.amount_to_cents;
        }
      });
      return { bdt: bdt / 100, rmb: rmb / 100 };
    },
    enabled: !!business?.id
  });

  // Landed Cost Calculation
  const totalQty = parseInt(qty) || 0;
  const costRmb = parseFloat(buyingCostRmb) || 0;
  const rate = parseFloat(exchangeRate) || 0;
  const shipRate = parseFloat(shippingRate) || 0;
  const addCost = parseFloat(additionalCost) || 0;

  const totalBuyingCostBDT = totalQty * costRmb * rate;
  const totalShippingCostBDT = totalQty * item.weight_per_unit * shipRate;
  const addCostBDT = additionalCostCurrency === 'RMB' ? addCost * rate : addCost;
  const grandTotalBDT = totalBuyingCostBDT + totalShippingCostBDT + addCostBDT;
  const landedCostUnit = totalQty > 0 ? grandTotalBDT / totalQty : 0;

  // Insufficient Balance Checks
  const requiredRMB = (totalQty * costRmb) + (additionalCostCurrency === 'RMB' ? addCost : 0);
  const requiredBDT = totalShippingCostBDT + (additionalCostCurrency === 'BDT' ? addCost : 0);
  
  const isRMBInsufficient = isPaid && requiredRMB > (balances?.rmb || 0);
  const isBDTInsufficient = isPaid && requiredBDT > (balances?.bdt || 0);

  const mutation = useMutation({
    mutationFn: async () => {
      if (isPaid) {
        if (isRMBInsufficient) throw new Error(`Insufficient RMB balance. Available: ${balances?.rmb}`);
        if (isBDTInsufficient) throw new Error(`Insufficient BDT balance. Available: ${balances?.bdt}`);
      }

      const { error: pError } = await supabase.from('purchase_transactions').insert({
        business_id: business?.id,
        item_id: item.id,
        quantity: totalQty,
        buying_cost_per_unit_rmb_cents: Math.round(costRmb * 100),
        exchange_rate_used: rate,
        shipping_method: shippingMethod,
        shipping_rate_bdt_per_kg_cents: Math.round(shipRate * 100),
        additional_cost_bdt_cents: Math.round(addCostBDT * 100),
        additional_cost_currency: additionalCostCurrency,
        landed_cost_per_unit_bdt_cents: Math.round(landedCostUnit * 100),
        total_landed_cost_bdt_cents: Math.round(grandTotalBDT * 100),
        paid: isPaid
      });
      if (pError) throw pError;

      const { error: iError } = await supabase.from('inventory_items')
        .update({ 
          current_stock: item.current_stock + totalQty,
          last_landed_cost_cents: Math.round(landedCostUnit * 100)
        })
        .eq('id', item.id);
      
      if (iError) throw iError;

      const { user } = (await supabase.auth.getUser()).data;
      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'RESTOCK_ITEM',
        details: {
          title: `Restocked: ${item.name}`,
          sub: `Added ${totalQty} ${item.unit}`,
          amount: `+${totalQty}`,
          type: 'inventory'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    },
    onError: (err: any) => {
      alert(err.message);
    }
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-y-auto">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-xl rounded-3xl shadow-2xl relative z-10 my-8"
      >
        <div className="p-6 border-b border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 font-bold">
               <Truck className="w-5 h-5" />
             </div>
             <div className="text-left">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Stock-in: {item.name}</h2>
                <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">Add Purchase Record</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-50"><X className="w-5 h-5 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 gap-4">
            <Input label="Quantity" type="number" value={qty} onChange={handleQtyChange} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input label="Buying Cost (RMB Total)" type="number" value={totalCostRmb} onChange={handleTotalRmbChange} />
              <Input label="Unit Cost (RMB)" type="number" value={buyingCostRmb} onChange={handleUnitRmbChange} />
              <Input label="Daily RMB Rate" type="number" value={exchangeRate} onChange={setExchangeRate} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Shipping Method</label>
                <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 font-bold h-11">
                  {['SEA', 'AIR', 'LUGGAGE'].map(m => (
                    <button 
                      key={m} 
                      type="button"
                      onClick={() => setShippingMethod(m)} 
                      className={`flex-1 flex items-center justify-center rounded-lg text-[9px] uppercase transition-all ${shippingMethod === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <Input label="Shipping Rate (BDT/kg)" type="number" value={shippingRate} onChange={setShippingRate} />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1.5 text-left">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">Other Cost</label>
                  <div className="flex gap-2">
                     <input 
                       type="number"
                       className="w-full bg-slate-50 border border-slate-100 h-11 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-medium"
                       value={additionalCost}
                       onChange={(e) => setAdditionalCost(e.target.value)}
                     />
                     <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 font-bold h-11">
                       {['BDT', 'RMB'].map(c => (
                         <button 
                           key={c} 
                           onClick={() => setAdditionalCostCurrency(c as any)} 
                           className={`px-3 flex items-center justify-center rounded-lg text-[9px] uppercase transition-all ${additionalCostCurrency === c ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
                         >
                           {c}
                         </button>
                       ))}
                     </div>
                  </div>
               </div>
               <div className="flex flex-col text-left">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 ml-1">Payment Status</label>
                  <button 
                   onClick={() => setIsPaid(!isPaid)}
                   className={`flex-1 flex items-center justify-center gap-2 rounded-xl border font-bold text-xs transition-all ${isPaid ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                  >
                    {isPaid ? 'Supplier Paid' : 'Unpaid (Payable)'}
                  </button>
               </div>
            </div>
          </div>

          {(isRMBInsufficient || isBDTInsufficient) && (
            <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <div className="text-left">
                <p className="text-[9px] font-black text-red-600 uppercase tracking-widest">Insufficient Funds</p>
                <p className="text-[10px] font-medium text-red-500 leading-tight">
                  You need more {isRMBInsufficient ? 'RMB' : 'BDT'} in your hub wallet to mark this as paid.
                </p>
              </div>
            </div>
          )}

          <div className="p-6 rounded-3xl bg-slate-900 text-white relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-3xl" />
            <h3 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">Landed Cost Calculation</h3>
            <div className="space-y-2 mb-6 border-b border-white/10 pb-4">
              <BreakdownRow label="Product Cost (BDT)" value={totalBuyingCostBDT} />
              <BreakdownRow label="Shipping Cost (BDT)" value={totalShippingCostBDT} />
              <BreakdownRow label="Other Cost (converted)" value={addCostBDT} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                 <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest block font-sans">Unit Landed Cost</span>
                 <p className="text-2xl font-bold font-mono tracking-tighter">৳{landedCostUnit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <div className="text-right">
                 <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block font-sans">Grand Total</span>
                 <p className="text-lg font-bold font-mono text-emerald-400 tracking-tight">৳{grandTotalBDT.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95">Cancel</button>
          <button 
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (isPaid && (isRMBInsufficient || isBDTInsufficient))}
            className="flex-[2] py-4 bg-blue-600 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-xl shadow-blue-100 transition-all active:scale-95 disabled:opacity-50"
          >
            {mutation.isPending ? 'Confirming Purchase...' : 'Confirm Stock-In'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: any) {
  return (
    <div className="space-y-1.5 flex-1">
      <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 ml-1">{label}</label>
      <input 
        type={type}
        className="w-full bg-slate-50 border border-slate-100 h-11 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-base md:text-sm font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FormRow({ label, value, onChange, placeholder, type = "text", sub, step }: any) {
  return (
    <div className="space-y-1 flex-1">
      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest ml-1 min-h-[14px] flex items-center">
        {label} {sub && <span className="text-slate-300 normal-case ml-1">({sub})</span>}
      </label>
      <input 
        type={type}
        step={step}
        placeholder={placeholder}
        className="w-full bg-slate-50 border border-slate-100 h-10 px-4 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 text-base md:text-sm"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={e => {
          if (type === 'number' && (value === '0' || value === '0.00' || value === '0.0')) {
            onChange('');
          }
        }}
      />
    </div>
  );
}

function SummaryRow2({ label, value, total }: { label: string, value: string, total?: boolean }) {
  return (
    <div className={`flex justify-between items-center ${total ? 'text-sm font-black uppercase tracking-tight' : 'text-xs font-bold text-slate-500'}`}>
      <span className={total ? 'text-slate-900' : ''}>{label}</span>
      <span className={total ? 'text-slate-900 font-mono' : 'text-slate-900 font-bold'}>{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string, value: string, bold?: boolean }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="font-bold text-white/40 uppercase tracking-widest">{label}</span>
      <span className={`font-mono ${bold ? 'text-lg font-black text-emerald-400' : 'font-bold text-white text-xs'}`}>{value}</span>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string, value: number }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-white/60 font-medium">{label}</span>
      <span className="font-mono font-bold tracking-tight">৳{value.toLocaleString()}</span>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({ item, onClose }: { item: InventoryItem, onClose: () => void }) {
  const { business } = useBusiness();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Get all sales associated with this item
      const { data: relatedSales } = await supabase
        .from('sales')
        .select('id')
        .eq('item_id', item.id);

      if (relatedSales && relatedSales.length > 0) {
        const saleIds = relatedSales.map(s => s.id);

        // Fetch distributions for these sales to reverse partner balances
        const { data: distributions } = await supabase
          .from('partner_profit_distributions')
          .select('partner_id, amount_cents')
          .in('sale_id', saleIds);

        if (distributions && distributions.length > 0) {
          // Reverse each distribution
          for (const dist of distributions) {
            await supabase.rpc('increment_partner_balance', { 
              p_id: dist.partner_id, 
              amount_cents: -dist.amount_cents 
            });
          }
        }

        // 2. Delete related records for these sales
        await Promise.all([
          supabase.from('customer_ledger').delete().in('reference_id', saleIds),
          supabase.from('partner_profit_distributions').delete().in('sale_id', saleIds)
        ]);

        // 3. Delete the sales themselves
        await supabase.from('sales').delete().in('id', saleIds);
      }

      // 4. Delete the item (purchase_transactions will cascade delete)
      const { error } = await supabase
        .from('inventory_items')
        .delete()
        .eq('id', item.id);
      
      if (error) throw error;

      // Log Activity
      await logActivity({
        business_id: business?.id || '',
        user_id: user?.id,
        action: 'DELETE_ITEM',
        details: {
          title: `Deleted Item: ${item.name}`,
          sub: 'Stock Record & History Removed',
          amount: 'DELETED',
          type: 'inventory'
        }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balances'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      onClose();
    }
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl relative overflow-hidden z-10 p-8 text-center"
      >
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Delete Product?</h2>
        <p className="text-sm text-slate-500 mb-8 leading-relaxed">
          Are you sure you want to delete <span className="font-bold text-slate-900">"{item.name}"</span>? This action cannot be undone and will remove all associated stock data.
        </p>
        <div className="flex flex-col gap-3">
          <button 
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="w-full h-14 bg-red-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-red-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {mutation.isPending ? 'Deleting...' : 'Yes, Delete Product'}
          </button>
          <button 
            onClick={onClose}
            className="w-full py-3 text-slate-400 font-bold text-xs uppercase tracking-widest"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}

