import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  AlertTriangle,
  MoreVertical,
  Package,
  Eye,
  Barcode,
  Printer,
  History,
} from "lucide-react";
import ProductForm from "@/components/forms/product-form";
import ProductSalesHistory from "@/components/modals/product-sales-history";
import BarcodeGenerator from "@/components/barcode/barcode-generator";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Product } from "@shared/schema";

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [showBarcodeGenerator, setShowBarcodeGenerator] = useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] =
    useState<Product | null>(null);

  const { toast } = useToast();

  // Function to generate and print barcode
  const printProductBarcode = (product: Product) => {
    const barcode = product.sku || product.id; // استخدام SKU أو ID كباركود

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // إنشاء نمط باركود بسيط باستخدام Canvas
    const createBarcodeCanvas = (value: string) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      canvas.width = 300;
      canvas.height = 100;

      // خلفية بيضاء
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // إنشاء نمط الباركود
      ctx.fillStyle = 'black';
      const barWidth = 2;
      let x = 20;

      for (let i = 0; i < value.length; i++) {
        const charCode = value.charCodeAt(i);
        const pattern = charCode.toString(2).padStart(8, '0');

        for (let j = 0; j < pattern.length; j++) {
          if (pattern[j] === '1') {
            ctx.fillRect(x, 10, barWidth, 60);
          }
          x += barWidth;
        }
        x += 2;
      }

      // إضافة النص تحت الباركود
      ctx.fillStyle = 'black';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(value, canvas.width / 2, 85);

      return canvas.toDataURL();
    };

    const barcodeDataUrl = createBarcodeCanvas(barcode);

    printWindow.document.write(`
      <html>
        <head>
          <title>طباعة باركود - ${product.name}</title>
          <style>
            body { 
              margin: 0; 
              padding: 20px; 
              font-family: Arial, sans-serif; 
              text-align: center;
              direction: rtl;
            }
            .barcode-container {
              border: 2px solid #333;
              padding: 15px;
              margin: 10px auto;
              width: fit-content;
              background: white;
            }
            .product-info {
              margin-bottom: 10px;
              font-size: 14px;
              font-weight: bold;
            }
            .price-info {
              margin-bottom: 10px;
              font-size: 12px;
              color: #666;
            }
            .barcode-image {
              margin: 10px 0;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="barcode-container">
            <div class="product-info">${product.name}</div>
            <div class="price-info">السعر: ${Number(product.price).toFixed(2)} ${product.currency === 'USD' ? '$' : '₺'}</div>
            <div class="barcode-image">
              <img src="${barcodeDataUrl}" alt="باركود" />
            </div>
            <div style="font-size: 10px; color: #666;">الكود: ${barcode}</div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 100);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    toast({
      title: "تتم الطباعة",
      description: `جاري طباعة باركود ${product.name}`,
    });
  };

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const url = search.trim() ? `/api/products?search=${encodeURIComponent(search)}` : "/api/products";
      const response = await apiRequest("GET", url);
      return await response.json();
    },
    retry: false,
  });

  const deleteProductMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "تم الحذف",
        description: "تم حذف المنتج بنجاح",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "غير مصرح",
          description: "تم تسجيل خروجك. جارٍ تسجيل الدخول مرة أخرى...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "خطأ",
        description: "فشل في حذف المنتج",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowEditForm(true);
  };

  const handleDelete = (id: string) => {
    const product = products.find(p => p.id === id);
    const productName = product?.name || "هذا المنتج";

    if (confirm(`هل أنت متأكد من حذف المنتج "${productName}"؟\n\nهذا الإجراء لا يمكن التراجع عنه.`)) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleViewSalesHistory = (product: Product) => {
    setSelectedProductForHistory(product);
    setShowSalesHistory(true);
  };

  const getCurrencySymbol = (currency: string) => {
    return currency === "USD" ? "$" : "₺";
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="إدارة المخزون"
          subtitle="إدارة وتتبع المنتجات والمخزون"
        />
        <main className="flex-1 overflow-auto p-6">
          {/* Search and Add */}
          <div className="flex items-center justify-between mb-6">
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="البحث في المنتجات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-4 w-4 ml-2" />
              إضافة منتج جديد
            </Button>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-slate-200 rounded w-1/2 mb-4"></div>
                    <div className="h-8 bg-slate-200 rounded w-full"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : products.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-slate-800 mb-2">لا توجد منتجات</h3>
                <p className="text-slate-600 mb-4">
                  {search ? "لم يتم العثور على منتجات مطابقة للبحث" : "ابدأ بإضافة منتجات إلى مخزونك"}
                </p>
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة منتج جديد
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product: Product) => (
                <Card key={product.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-1">{product.name}</CardTitle>
                        <p className="text-sm text-slate-600">{product.sku}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-orange-600 hover:text-orange-700"
                          onClick={() => handleViewSalesHistory(product)}
                          title="سجل المبيعات"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                          onClick={() => handleEdit(product)}
                          title="تعديل المنتج"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                          onClick={() => handleDelete(product.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => printProductBarcode(product)}
                          title="طباعة الباركود"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">السعر:</span>
                        <span className="font-semibold text-green-600">
                          {product.price} {getCurrencySymbol(product.currency || "TRY")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">الكمية:</span>
                        <Badge 
                          variant={(product.quantity || 0) <= (product.minQuantity || 0) ? "destructive" : "secondary"}
                        >
                          {product.quantity || 0}
                        </Badge>
                      </div>
                      {product.category && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-600">الفئة:</span>
                          <Badge variant="outline">{product.category}</Badge>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-600">الحالة:</span>
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? "نشط" : "غير نشط"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </main>
      </div>

      <ProductForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <ProductForm 
        open={showEditForm} 
        onClose={() => {
          setShowEditForm(false);
          setEditingProduct(null);
        }}
        product={editingProduct}
      />
      <ProductSalesHistory
        open={showSalesHistory}
        onClose={() => {
          setShowSalesHistory(false);
          setSelectedProductForHistory(null);
        }}
        product={selectedProductForHistory}
      />
    </div>
  );
}