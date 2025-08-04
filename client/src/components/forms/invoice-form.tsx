import React, { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { type InsertTransaction, type Customer, type Product } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Calculator, Receipt, Search, QrCode, X } from "lucide-react";
import { z } from "zod";

interface InvoiceFormProps {
  open: boolean;
  onClose: () => void;
}

const invoiceSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1, "اسم العميل مطلوب"),
  discount: z.string().default("0"),
  paymentType: z.enum(["cash", "credit"]).default("cash"),
  currency: z.enum(["TRY", "USD"]).default("TRY"),
  items: z.array(z.object({
    productId: z.string().min(1, "المنتج مطلوب"),
    productName: z.string().min(1, "اسم المنتج مطلوب"),
    quantity: z.number().min(1, "الكمية يجب أن تكون أكبر من 0"),
    price: z.string().min(1, "السعر مطلوب"),
    total: z.string(),
  })).min(1, "يجب إضافة منتج واحد على الأقل"),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

export default function InvoiceForm({ open, onClose }: InvoiceFormProps) {
  const { toast } = useToast();
  const [subtotal, setSubtotal] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [itemsLocked, setItemsLocked] = useState(false);
  const [discountEnabled, setDiscountEnabled] = useState(false);

  // Fetch products and customers
  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    retry: false,
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    retry: false,
  });

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerName: "",
      customerId: "",
      discount: "0",
      paymentType: "cash",
      currency: "TRY",
      items: [{ productId: "", productName: "", quantity: 1, price: "0", total: "0" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchedItems = form.watch("items");
  const watchedDiscount = form.watch("discount");

  // Calculate totals with real-time updates
  const calculateTotals = useCallback(() => {
    const itemsTotal = watchedItems.reduce((sum, item) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      return sum + (price * quantity);
    }, 0);

    const discount = discountEnabled ? (Number(watchedDiscount) || 0) : 0;
    const total = Math.max(0, itemsTotal - discount);

    setSubtotal(itemsTotal);
    setFinalTotal(total);

    // Update item totals immediately
    watchedItems.forEach((item, index) => {
      const price = Number(item.price) || 0;
      const quantity = Number(item.quantity) || 0;
      const itemTotal = price * quantity;
      form.setValue(`items.${index}.total`, itemTotal.toString(), { shouldValidate: false });
    });
  }, [watchedItems, watchedDiscount, form]);

  // Calculate totals on every change
  useEffect(() => {
    calculateTotals();
  }, [calculateTotals]);

  const createInvoiceMutation = useMutation({
    mutationFn: async (data: InvoiceFormData) => {
      console.log("Creating invoice with data:", data);

      // Recalculate totals to ensure accuracy
      const itemsTotal = data.items.reduce((sum, item) => {
        return sum + (Number(item.price) * item.quantity);
      }, 0);

      const discountAmount = Number(data.discount) || 0;
      const calculatedTotal = itemsTotal - discountAmount;

      const transactionData: InsertTransaction = {
        customerId: data.customerId || null,
        customerName: data.customerName,
        total: calculatedTotal.toString(),
        discount: data.discount,
        tax: "0",
        paymentType: data.paymentType,
        currency: data.currency,
        status: "completed",
        transactionType: "sale",
      };

      const items = data.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        total: (Number(item.price) * item.quantity).toString(),
      }));

      console.log("Sending transaction data:", { transaction: transactionData, items });
      return await apiRequest("POST", "/api/transactions", { transaction: transactionData, items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/metrics"] });
      toast({
        title: "تم بنجاح",
        description: "تم إنشاء الفاتورة بنجاح",
      });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      console.error("Invoice creation error:", error);
      toast({
        title: "خطأ",
        description: "فشل في إنشاء الفاتورة",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InvoiceFormData) => {
    console.log("Form submitted with data:", data);
    createInvoiceMutation.mutate(data);
  };

  const handleProductChange = (index: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.productId`, productId);
      form.setValue(`items.${index}.productName`, product.name);
      form.setValue(`items.${index}.price`, product.price);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      form.setValue("customerId", customerId);
      form.setValue("customerName", customer.name);
    }
  };

  const getCurrencySymbol = (curr: string) => {
    return curr === "USD" ? "$" : "₺";
  };

  // Enhanced search filtering with better matching
  const filteredProducts = products.filter(product => {
    const searchLower = productSearchQuery.toLowerCase().trim();
    
    // Skip if search is too short
    if (searchLower.length < 1) return false;
    
    // Check various fields for matches
    const nameMatch = product.name.toLowerCase().includes(searchLower);
    const skuMatch = product.sku.toLowerCase().includes(searchLower);
    const barcodeMatch = product.barcode && product.barcode.includes(searchLower);
    const categoryMatch = product.category && product.category.toLowerCase().includes(searchLower);
    
    // Word-based search for better accuracy
    const searchWords = searchLower.split(' ').filter(word => word.length > 0);
    const nameWords = product.name.toLowerCase().split(' ');
    const wordMatch = searchWords.some(searchWord => 
      nameWords.some(nameWord => nameWord.startsWith(searchWord))
    );
    
    return nameMatch || skuMatch || barcodeMatch || categoryMatch || wordMatch;
  }).sort((a, b) => {
    // Sort by relevance - exact matches first, then partial matches
    const searchLower = productSearchQuery.toLowerCase().trim();
    
    const aExactName = a.name.toLowerCase() === searchLower;
    const bExactName = b.name.toLowerCase() === searchLower;
    
    if (aExactName && !bExactName) return -1;
    if (!aExactName && bExactName) return 1;
    
    const aStartsWithName = a.name.toLowerCase().startsWith(searchLower);
    const bStartsWithName = b.name.toLowerCase().startsWith(searchLower);
    
    if (aStartsWithName && !bStartsWithName) return -1;
    if (!aStartsWithName && bStartsWithName) return 1;
    
    // Finally sort by name alphabetically
    return a.name.localeCompare(b.name, 'ar');
  });

  // Handle barcode scan
  const handleBarcodeScan = () => {
    if (!barcodeInput.trim()) return;

    const product = products.find(p => p.barcode === barcodeInput.trim());
    if (product) {
      // Add new item or update existing one
      const newItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        total: product.price,
      };

      append(newItem);
      setBarcodeInput("");
      setShowBarcodeInput(false);

      toast({
        title: "تم إضافة المنتج",
        description: `تم إضافة ${product.name} للفاتورة`,
      });
    } else {
      toast({
        title: "منتج غير موجود",
        description: "لم يتم العثور على منتج بهذا الباركود",
        variant: "destructive",
      });
    }
  };

  // Quick add product from search with enhanced feedback
  const addProductFromSearch = (product: Product) => {
    // Check if product already exists in items
    const existingItemIndex = watchedItems.findIndex(item => item.productId === product.id);
    
    if (existingItemIndex >= 0) {
      // If product exists, increase quantity
      const currentQuantity = watchedItems[existingItemIndex].quantity;
      form.setValue(`items.${existingItemIndex}.quantity`, currentQuantity + 1);
      
      toast({
        title: "تم زيادة الكمية",
        description: `تم زيادة كمية ${product.name} إلى ${currentQuantity + 1}`,
      });
    } else {
      // Add new item
      const newItem = {
        productId: product.id,
        productName: product.name,
        quantity: 1,
        price: product.price,
        total: product.price,
      };

      append(newItem);
      
      toast({
        title: "تم إضافة المنتج",
        description: `تم إضافة ${product.name} للفاتورة`,
      });
    }

    setProductSearchQuery("");
    setSelectedItemIndex(null);
  };

  const saveItems = () => {
    // Validate that all items have required fields
    const hasValidItems = watchedItems.every(item => 
      item.productId && item.productName && item.quantity > 0 && Number(item.price) > 0
    );

    if (!hasValidItems) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى التأكد من ملء جميع بيانات الأصناف",
        variant: "destructive",
      });
      return;
    }

    setItemsLocked(true);
    toast({
      title: "تم حفظ الأصناف",
      description: "تم قفل الأصناف، يمكنك الآن المتابعة لإتمام الفاتورة",
    });
  };

  const editItems = () => {
    setItemsLocked(false);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="invoice-description">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            إنشاء فاتورة جديدة
          </DialogTitle>
          <div id="invoice-description" className="sr-only">
            نموذج إنشاء فاتورة جديدة مع إضافة المنتجات والعملاء
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">معلومات العميل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>اختيار عميل موجود</Label>
                  <Select onValueChange={handleCustomerChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر عميل" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerName">اسم العميل *</Label>
                  <Input
                    id="customerName"
                    placeholder="أدخل اسم العميل"
                    {...form.register("customerName")}
                    className="text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>العملة</Label>
                  <Select 
                    value={form.watch("currency")} 
                    onValueChange={(value) => form.setValue("currency", value as "TRY" | "USD")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العملة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TRY">ليرة تركية (₺)</SelectItem>
                      <SelectItem value="USD">دولار أمريكي ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>نوع الدفع</Label>
                  <Select 
                    value={form.watch("paymentType")} 
                    onValueChange={(value) => form.setValue("paymentType", value as "cash" | "credit")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع الدفع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقد</SelectItem>
                      <SelectItem value="credit">دين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                الأصناف
                <div className="flex gap-2">
                  {!itemsLocked ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => setShowBarcodeInput(!showBarcodeInput)}
                        variant="outline"
                      >
                        <QrCode className="h-4 w-4 ml-2" />
                        مسح باركود
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => append({ productId: "", productName: "", quantity: 1, price: "0", total: "0" })}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Plus className="h-4 w-4 ml-2" />
                        إضافة صنف
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={saveItems}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        حفظ الأصناف
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      onClick={editItems}
                      variant="outline"
                      className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      تعديل الأصناف
                    </Button>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Items locked message */}
              {itemsLocked && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 text-green-800">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="font-medium">تم حفظ الأصناف وقفل التعديل</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-green-700 mt-2 bg-green-100 px-3 py-2 rounded">
                    <span>المجموع الفرعي: <strong>{subtotal.toFixed(2)} {getCurrencySymbol(form.watch("currency"))}</strong></span>
                    <span>المجموع النهائي: <strong className="text-green-800">{finalTotal.toFixed(2)} {getCurrencySymbol(form.watch("currency"))}</strong></span>
                  </div>
                </div>
              )}

              {/* Barcode Input */}
              {!itemsLocked && showBarcodeInput && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <QrCode className="h-5 w-5 text-blue-600" />
                    <Label className="text-blue-800 font-medium">مسح الباركود</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowBarcodeInput(false)}
                      className="ml-auto"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={barcodeInput}
                      onChange={(e) => setBarcodeInput(e.target.value)}
                      placeholder="امسح أو أدخل رقم الباركود"
                      className="text-right"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleBarcodeScan();
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      type="button"
                      onClick={handleBarcodeScan}
                      disabled={!barcodeInput.trim()}
                      size="sm"
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Product Search with Enhanced Suggestions */}
              {!itemsLocked && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 mb-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-5 w-5 text-blue-600" />
                  <Label className="font-medium text-blue-800">البحث السريع والاقتراحات الذكية</Label>
                </div>
                
                <div className="relative">
                  <Input
                    value={productSearchQuery}
                    onChange={(e) => setProductSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو الكود أو الباركود... (أدخل حرف واحد للبدء)"
                    className="text-right mb-2 border-blue-200 focus:border-blue-400 focus:ring-blue-400"
                    autoComplete="off"
                  />
                  
                  {/* Show suggestions even with one character */}
                  {productSearchQuery.length >= 1 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto border border-blue-200 rounded-lg bg-white shadow-lg">
                      {filteredProducts.length > 0 ? (
                        <>
                          <div className="bg-blue-50 px-3 py-2 text-sm text-blue-700 font-medium border-b">
                            {filteredProducts.length} منتج متاح
                          </div>
                          {filteredProducts.slice(0, 8).map((product, index) => (
                            <div
                              key={product.id}
                              className={`flex items-center justify-between p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0 transition-colors duration-150 ${
                                index === 0 ? 'bg-blue-25' : ''
                              }`}
                              onClick={() => addProductFromSearch(product)}
                            >
                              <div className="flex-1">
                                <div className="font-medium text-gray-900 mb-1">
                                  {product.name}
                                  {(product.quantity || 0) <= (product.minQuantity || 0) && (
                                    <span className="mr-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      مخزون منخفض
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500 flex items-center gap-3">
                                  <span>كود: {product.sku}</span>
                                  <span>المخزون: {product.quantity || 0}</span>
                                  {product.category && <span>الفئة: {product.category}</span>}
                                </div>
                                {product.barcode && (
                                  <div className="text-xs text-gray-400 mt-1">
                                    باركود: {product.barcode}
                                  </div>
                                )}
                              </div>
                              <div className="text-left ml-3">
                                <div className="font-bold text-lg text-green-600 mb-1">
                                  {Number(product.price).toFixed(2)} {getCurrencySymbol(form.watch("currency"))}
                                </div>
                                <Button 
                                  size="sm" 
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    addProductFromSearch(product);
                                  }}
                                >
                                  <Plus className="h-3 w-3 ml-1" />
                                  إضافة
                                </Button>
                              </div>
                            </div>
                          ))}
                          {filteredProducts.length > 8 && (
                            <div className="bg-gray-50 px-3 py-2 text-center text-sm text-gray-600">
                              و {filteredProducts.length - 8} منتج آخر... استمر في الكتابة لتضييق النتائج
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-6">
                          <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                          <div className="text-gray-500 text-sm">لا توجد منتجات مطابقة للبحث</div>
                          <div className="text-gray-400 text-xs mt-1">جرب كلمات مختلفة أو تحقق من الإملاء</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Smart suggestions when no search */}
                {!productSearchQuery && (
                  <div className="mt-3">
                    <div className="text-sm text-blue-700 font-medium mb-2 flex items-center gap-2">
                      ⭐ منتجات مقترحة:
                      <span className="text-xs text-blue-500 font-normal">(الأكثر شيوعاً)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {products
                        .filter(p => (p.quantity || 0) > 0) // Only show available products
                        .slice(0, 6)
                        .map((product) => (
                        <Button
                          key={product.id}
                          size="sm"
                          variant="outline"
                          className="text-xs border-blue-200 hover:bg-blue-50 hover:border-blue-300 p-2 h-auto flex flex-col items-start justify-between"
                          onClick={() => addProductFromSearch(product)}
                        >
                          <div className="font-medium truncate w-full text-right">{product.name}</div>
                          <div className="flex justify-between w-full items-center mt-1">
                            <span className="text-green-600 font-bold">
                              {Number(product.price).toFixed(2)} {getCurrencySymbol(form.watch("currency"))}
                            </span>
                            <span className="text-gray-500 text-xs">
                              متوفر: {product.quantity || 0}
                            </span>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Search tips */}
                <div className="mt-3 bg-white/60 border border-blue-100 rounded p-2">
                  <div className="text-xs text-blue-600">
                    💡 <strong>نصائح البحث:</strong> يمكنك البحث بالاسم، الكود، الباركود، أو الفئة
                  </div>
                </div>
              </div>
              )}

              <div className="space-y-4">
                {fields.map((field, index) => (
                  <div key={field.id} className={`grid grid-cols-12 gap-3 items-end ${itemsLocked ? 'opacity-75' : ''}`}>
                    <div className="col-span-4 space-y-2">
                      <Label>المنتج</Label>
                      {watchedItems[index]?.productName ? (
                        <div className="h-10 bg-slate-50 border rounded-md flex items-center px-3">
                          <span className="flex-1">{watchedItems[index]?.productName}</span>
                          {!itemsLocked && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                form.setValue(`items.${index}.productId`, "");
                                form.setValue(`items.${index}.productName`, "");
                                form.setValue(`items.${index}.price`, "0");
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Select onValueChange={(value) => handleProductChange(index, value)} disabled={itemsLocked}>
                          <SelectTrigger>
                            <SelectValue placeholder="اختر المنتج أو استخدم البحث السريع" />
                          </SelectTrigger>
                          <SelectContent>
                            {products.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name} - {product.price} {getCurrencySymbol(form.watch("currency"))}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>

                    <div className="col-span-2 space-y-2">
                      <Label>الكمية</Label>
                      <Input
                        type="number"
                        min="1"
                        {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                        className="text-right"
                        disabled={itemsLocked}
                      />
                    </div>

                    <div className="col-span-2 space-y-2">
                      <Label>السعر</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...form.register(`items.${index}.price`)}
                        className="text-right"
                        disabled={itemsLocked}
                      />
                    </div>

                    <div className="col-span-3 space-y-2">
                      <Label>المجموع</Label>
                      <div className="h-10 bg-slate-50 border rounded-md flex items-center px-3 text-slate-600 font-medium">
                        {((Number(watchedItems[index]?.price) || 0) * (Number(watchedItems[index]?.quantity) || 0)).toFixed(2)} {getCurrencySymbol(form.watch("currency"))}
                      </div>
                    </div>

                    <div className="col-span-1">
                      {fields.length > 1 && !itemsLocked && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => remove(index)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                الإجماليات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="discount">الخصم</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant={discountEnabled ? "default" : "outline"}
                      onClick={() => {
                        setDiscountEnabled(!discountEnabled);
                        if (!discountEnabled) {
                          form.setValue("discount", "0");
                        }
                      }}
                      className={discountEnabled ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {discountEnabled ? "تعطيل الخصم" : "تفعيل الخصم"}
                    </Button>
                  </div>
                  <Input
                    id="discount"
                    type="number"
                    step="0.01"
                    {...form.register("discount")}
                    className="text-right"
                    disabled={!discountEnabled}
                    placeholder={discountEnabled ? "أدخل قيمة الخصم" : "الخصم معطل"}
                  />
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex justify-between items-center text-base">
                  <span className="text-slate-600">المجموع الفرعي:</span>
                  <span className="font-semibold text-slate-800 transition-all duration-200">{subtotal.toFixed(2)} {getCurrencySymbol(form.watch("currency"))}</span>
                </div>
                {discountEnabled && Number(watchedDiscount || 0) > 0 && (
                  <div className="flex justify-between items-center text-base">
                    <span className="text-slate-600">الخصم:</span>
                    <span className="font-semibold text-red-600 transition-all duration-200">-{Number(watchedDiscount || 0).toFixed(2)} {getCurrencySymbol(form.watch("currency"))}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xl font-bold border-t pt-3 mt-3">
                  <span className="text-slate-800">المجموع النهائي:</span>
                  <span className="text-blue-600 transition-all duration-200 bg-blue-50 px-3 py-1 rounded-lg">{finalTotal.toFixed(2)} {getCurrencySymbol(form.watch("currency"))}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Help Text */}
          <div className={`${itemsLocked ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'} border rounded-lg p-3`}>
            <div className={`text-sm ${itemsLocked ? 'text-green-800' : 'text-blue-800'}`}>
              {itemsLocked ? (
                <>
                  <div className="font-medium mb-1">تم حفظ الأصناف:</div>
                  <ul className="space-y-1 text-xs">
                    <li>• تم قفل جميع الأصناف من التعديل</li>
                    <li>• يمكنك الآن إكمال بيانات الفاتورة</li>
                    <li>• اضغط "تعديل الأصناف" للعودة للتعديل</li>
                  </ul>
                </>
              ) : (
                <>
                  <div className="font-medium mb-1">طرق إضافة المنتجات:</div>
                  <ul className="space-y-1 text-xs">
                    <li>• استخدم البحث السريع للعثور على المنتجات بسرعة</li>
                    <li>• امسح الباركود لإضافة المنتج مباشرة</li>
                    <li>• أو اختر من القائمة المنسدلة التقليدية</li>
                    <li>• اضغط "حفظ الأصناف" عند الانتهاء</li>
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={createInvoiceMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {createInvoiceMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جارٍ الإنشاء...
                </>
              ) : (
                <>
                  <Receipt className="h-4 w-4 ml-2" />
                  إنشاء الفاتورة
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}