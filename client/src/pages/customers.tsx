
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  User,
  Mail,
  Phone,
  MapPin,
  AlertTriangle,
  CreditCard,
  Users,
  History,
  Printer,
} from "lucide-react";
import CustomerForm from "@/components/forms/customer-form";
import CustomerHistoryModal from "@/components/modals/customer-history-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { Customer } from "@shared/schema";

export default function Customers() {
  const [search, setSearch] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const { toast } = useToast();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers", search],
    retry: false,
  });

  const deleteCustomerMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/customers/${id}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Failed to delete customer: ${response.status} - ${errorText}`,
        );
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "تم الحذف",
        description: "تم حذف العميل بنجاح",
      });
    },
    onError: (error: any) => {
      console.error("Delete customer error:", error);
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

      let errorMessage = "فشل في حذف العميل";
      if (error.message?.includes("not found")) {
        errorMessage = "العميل غير موجود";
      } else if (error.message?.includes("Failed to delete customer")) {
        errorMessage = "خطأ في قاعدة البيانات أثناء حذف العميل";
      }

      toast({
        title: "خطأ في حذف العميل",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleDelete = async (id: string) => {
    const customer = customers.find((c) => c.id === id);
    const customerName = customer?.name || "هذا العميل";

    if (
      confirm(
        `هل أنت متأكد من حذف ${customerName}؟\n\nهذا الإجراء لا يمكن التراجع عنه.`,
      )
    ) {
      try {
        await deleteCustomerMutation.mutateAsync(id);
      } catch (error) {
        console.error("Delete failed:", error);
      }
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowEditForm(true);
  };

  const handleShowHistory = (customer: Customer) => {
    setHistoryCustomer(customer);
    setShowHistory(true);
  };

  const getDebtStatusColor = (debt: string | number | undefined): string => {
    if (!debt) return "text-slate-500";
    const debtNumber = typeof debt === 'string' ? parseFloat(debt) : debt;
    if (isNaN(debtNumber)) return "text-slate-500";
    
    if (debtNumber >= 5000) {
      return "text-red-600 font-semibold";
    } else if (debtNumber > 0) {
      return "text-yellow-600";
    }
    return "text-slate-500";
  };

  const formatDebt = (debt: string | number | undefined): string => {
    if (!debt) return "0.00";
    const debtNumber = typeof debt === 'string' ? parseFloat(debt) : debt;
    if (isNaN(debtNumber)) return "0.00";
    return debtNumber.toFixed(2);
  };

  const printCustomerAddress = (customer: Customer) => {
    if (!customer.address) {
      toast({
        title: "تعذر الطباعة",
        description: "لا يوجد عنوان محدد لهذا العميل",
        variant: "destructive",
      });
      return;
    }

    // إنشاء باركود يحتوي على اسم العميل
    const barcodeValue = customer.name;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // إنشاء باركود بسيط
    const createAddressBarcode = (value: string) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return '';

      canvas.width = 250;
      canvas.height = 60;

      // خلفية بيضاء
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // إنشاء نمط الباركود
      ctx.fillStyle = 'black';
      const barWidth = 1.5;
      let x = 10;

      for (let i = 0; i < value.length; i++) {
        const charCode = value.charCodeAt(i);
        const pattern = charCode.toString(2).padStart(8, '0');

        for (let j = 0; j < pattern.length; j++) {
          if (pattern[j] === '1') {
            ctx.fillRect(x, 5, barWidth, 40);
          }
          x += barWidth;
        }
        x += 1;
      }

      // إضافة النص تحت الباركود
      ctx.fillStyle = 'black';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(value, canvas.width / 2, 55);

      return canvas.toDataURL();
    };

    const barcodeDataUrl = createAddressBarcode(barcodeValue);

    printWindow.document.write(`
      <html>
        <head>
          <title>عنوان العميل - ${customer.name}</title>
          <style>
            body { 
              margin: 0; 
              padding: 15px; 
              font-family: Arial, sans-serif; 
              direction: rtl;
              font-size: 12px;
            }
            .address-container {
              border: 2px solid #333;
              padding: 15px;
              margin: 10px auto;
              width: 300px;
              background: white;
              text-align: center;
            }
            .customer-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 10px;
              border-bottom: 1px solid #ccc;
              padding-bottom: 8px;
            }
            .address-text {
              margin: 10px 0;
              font-size: 14px;
              line-height: 1.4;
              text-align: right;
              padding: 8px;
              background: #f9f9f9;
              border-radius: 4px;
            }
            .barcode-section {
              margin-top: 15px;
              padding-top: 10px;
              border-top: 1px dashed #ccc;
            }
            .barcode-label {
              font-size: 10px;
              color: #666;
              margin-bottom: 5px;
            }
            @media print {
              body { margin: 0; padding: 5px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="address-container">
            <div class="customer-name">${customer.name}</div>
            <div class="address-text">${customer.address}</div>
            <div class="barcode-section">
              <div class="barcode-label">باركود العميل للشحنات</div>
              <img src="${barcodeDataUrl}" alt="باركود العميل" />
            </div>
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
      description: `جاري طباعة عنوان ${customer.name}`,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          title="إدارة العملاء"
          subtitle="إدارة قاعدة بيانات العملاء والتواصل معهم"
        />
        <main className="flex-1 overflow-auto p-6">
          {/* Search and Add */}
          <div className="flex items-center justify-between mb-6">
            <div className="relative max-w-md">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="البحث في العملاء..."
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
              إضافة عميل جديد
            </Button>
          </div>

          {/* Customers Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                قائمة العملاء
                <Badge variant="secondary" className="mr-2">
                  {customers.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-12 bg-slate-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : customers.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    لا يوجد عملاء
                  </h3>
                  <p className="text-slate-600 mb-4">
                    {search
                      ? "لم يتم العثور على عملاء مطابقين للبحث"
                      : "ابدأ بإضافة عملاء إلى قاعدة البيانات"}
                  </p>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة عميل جديد
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-right font-semibold">اسم العميل</TableHead>
                        <TableHead className="text-right font-semibold">معلومات الاتصال</TableHead>
                        <TableHead className="text-right font-semibold">العنوان</TableHead>
                        <TableHead className="text-right font-semibold">الدين الحالي</TableHead>
                        <TableHead className="text-right font-semibold">الحالة</TableHead>
                        <TableHead className="text-right font-semibold">تاريخ الانضمام</TableHead>
                        <TableHead className="text-right font-semibold">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((customer: Customer) => (
                        <TableRow key={customer.id} className="hover:bg-slate-50/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-100 rounded-lg">
                                <User className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium text-slate-800">
                                  {customer.name}
                                </p>
                                <p className="text-sm text-slate-500">
                                  ID: {customer.id.slice(0, 8)}...
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          
                          <TableCell>
                            <div className="space-y-1">
                              {customer.phone && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Phone className="h-3 w-3 text-slate-400" />
                                  <span>{customer.phone}</span>
                                </div>
                              )}
                              {customer.email && (
                                <div className="flex items-center gap-2 text-sm">
                                  <Mail className="h-3 w-3 text-slate-400" />
                                  <span className="truncate max-w-[200px]">{customer.email}</span>
                                </div>
                              )}
                              {!customer.phone && !customer.email && (
                                <span className="text-sm text-slate-400">لا توجد معلومات</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            {customer.address ? (
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 flex-1">
                                  <MapPin className="h-3 w-3 text-slate-400 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm text-slate-600 line-clamp-2 max-w-[150px]">
                                    {customer.address}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 w-6 p-0 text-blue-600 hover:text-blue-700"
                                  onClick={() => printCustomerAddress(customer)}
                                  title="طباعة عنوان مع باركود"
                                >
                                  <Printer className="h-3 w-3" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">غير محدد</span>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-2">
                              {customer.totalDebt && parseFloat(customer.totalDebt) > 0 ? (
                                <>
                                  <AlertTriangle 
                                    className={`h-4 w-4 ${
                                      parseFloat(customer.totalDebt) >= 5000 
                                        ? "text-red-500" 
                                        : "text-yellow-500"
                                    }`} 
                                  />
                                  <span className={getDebtStatusColor(customer.totalDebt)}>
                                    {formatDebt(customer.totalDebt)} ₺
                                  </span>
                                </>
                              ) : (
                                <span className="text-sm text-slate-500">0.00 ₺</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge variant={customer.isActive ? "default" : "secondary"}>
                              {customer.isActive ? "نشط" : "غير نشط"}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <span className="text-sm text-slate-600">
                              {new Date(customer.createdAt || "").toLocaleDateString("ar-SA", {
                                year: "numeric",
                                month: "short",
                                day: "numeric"
                              })}
                            </span>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-purple-600 hover:text-purple-700"
                                onClick={() => handleShowHistory(customer)}
                                title="عرض السجل"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                                onClick={() => handleEdit(customer)}
                                title="تعديل العميل"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                onClick={() => handleDelete(customer.id)}
                                disabled={deleteCustomerMutation.isPending}
                                title="حذف العميل"
                              >
                                {deleteCustomerMutation.isPending ? (
                                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <CustomerForm open={showAddForm} onClose={() => setShowAddForm(false)} />
      <CustomerForm
        open={showEditForm}
        onClose={() => {
          setShowEditForm(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
      />
      <CustomerHistoryModal
        open={showHistory}
        onClose={() => {
          setShowHistory(false);
          setHistoryCustomer(null);
        }}
        customer={historyCustomer}
      />
    </div>
  );
}
