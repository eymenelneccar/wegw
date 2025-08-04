
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ShoppingCart, Calendar } from "lucide-react";
import type { Product } from "@shared/schema";

interface ProductSalesHistoryProps {
  open: boolean;
  onClose: () => void;
  product: Product | null;
}

interface SalesHistoryItem {
  transactionId: string;
  transactionNumber: string;
  customerName: string;
  quantity: number;
  price: string;
  total: string;
  saleDate: string;
  status: string;
}

interface SalesHistoryData {
  totalQuantitySold: number;
  totalSales: number;
  salesHistory: SalesHistoryItem[];
}

export default function ProductSalesHistory({ open, onClose, product }: ProductSalesHistoryProps) {
  const { data: salesData, isLoading } = useQuery<SalesHistoryData>({
    queryKey: ["/api/products", product?.id, "sales-history"],
    queryFn: async () => {
      if (!product?.id) return { totalQuantitySold: 0, totalSales: 0, salesHistory: [] };
      const response = await apiRequest("GET", `/api/products/${product.id}/sales-history`);
      return await response.json();
    },
    enabled: open && !!product?.id,
    retry: false,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-600";
      case "pending":
        return "bg-yellow-100 text-yellow-600";
      case "cancelled":
        return "bg-red-100 text-red-600";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "مكتملة";
      case "pending":
        return "معلقة";
      case "cancelled":
        return "ملغية";
      default:
        return status;
    }
  };

  const getCurrencySymbol = (currency: string) => {
    return currency === "USD" ? "$" : "₺";
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <FileText className="h-5 w-5" />
            سجل مبيعات - {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-600">إجمالي المبيعات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-600" />
                  <span className="text-2xl font-bold text-blue-600">
                    {salesData?.totalSales || 0}
                  </span>
                  <span className="text-sm text-slate-600">فاتورة</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-slate-600">إجمالي الكمية المباعة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-green-600" />
                  <span className="text-2xl font-bold text-green-600">
                    {salesData?.totalQuantitySold || 0}
                  </span>
                  <span className="text-sm text-slate-600">وحدة</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sales History Table */}
          <Card>
            <CardHeader>
              <CardTitle>تفاصيل المبيعات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6">
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center gap-4">
                        <div className="h-4 bg-slate-200 rounded flex-1"></div>
                        <div className="h-4 bg-slate-200 rounded w-20"></div>
                        <div className="h-4 bg-slate-200 rounded w-16"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : !salesData || salesData.salesHistory.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">لا توجد مبيعات</h3>
                  <p className="text-slate-600">
                    لم يتم بيع هذا المنتج بعد
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">رقم الفاتورة</th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">العميل</th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">الكمية</th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">السعر</th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">المجموع</th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">الحالة</th>
                        <th className="text-right px-6 py-4 text-sm font-medium text-slate-600">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {salesData.salesHistory.map((sale: SalesHistoryItem) => (
                        <tr key={`${sale.transactionId}-${sale.transactionNumber}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-blue-600">
                            {sale.transactionNumber}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {sale.customerName || "عميل غير محدد"}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-800">
                            {sale.quantity}
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {Number(sale.price || 0).toLocaleString()} {getCurrencySymbol(product.currency || "TRY")}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-green-600">
                            {Number(sale.total || 0).toLocaleString()} {getCurrencySymbol(product.currency || "TRY")}
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={getStatusColor(sale.status || "pending")}>
                              {getStatusText(sale.status || "pending")}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-600">
                            {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('ar-SA') : "تاريخ غير محدد"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
