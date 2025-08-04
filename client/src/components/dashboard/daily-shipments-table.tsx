
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QrCode,
  Truck,
  Plus,
  Search,
  Trash2,
  Package,
  Calendar,
  Printer,
  CreditCard,
  AlertCircle,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Shipment {
  id: string;
  customerName: string;
  address: string;
  phone?: string;
  status: "paid" | "unpaid";
  createdAt: string;
}

interface DailyShipmentsTableProps {
  currency: string;
}

export default function DailyShipmentsTable({ currency }: DailyShipmentsTableProps) {
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // بيانات وهمية للعرض
  const { data: shipments = [], isLoading } = useQuery<Shipment[]>({
    queryKey: ["/api/shipments", search],
    queryFn: async () => {
      const mockData = [
        {
          id: "1",
          customerName: "أحمد محمد السعدي",
          address: "شارع الملك عبد العزيز، حي الملز، الرياض 12345",
          phone: "0501234567",
          status: "paid",
          createdAt: new Date().toISOString(),
        },
        {
          id: "2", 
          customerName: "فاطمة علي الزهراني",
          address: "شارع التحلية، حي النزهة، جدة 21563",
          phone: "0509876543",
          status: "unpaid",
          createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          id: "3",
          customerName: "خالد عبدالله القحطاني", 
          address: "طريق الأمير سلطان، حي العليا، الرياض 11564",
          phone: "0551122334",
          status: "unpaid",
          createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
        }
      ] as Shipment[];

      // تصفية البحث
      if (search.trim()) {
        return mockData.filter(item => 
          item.customerName.toLowerCase().includes(search.toLowerCase()) ||
          item.address.toLowerCase().includes(search.toLowerCase()) ||
          item.phone?.includes(search)
        );
      }
      
      return mockData;
    },
    retry: false,
  });

  const addShipmentMutation = useMutation({
    mutationFn: async (customerName: string) => {
      return {
        id: Date.now().toString(),
        customerName,
        address: "عنوان تم الحصول عليه من الباركود",
        status: "unpaid",
        createdAt: new Date().toISOString(),
      } as Shipment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      setBarcodeInput("");
      setShowBarcodeScanner(false);
      toast({
        title: "تم إضافة الشحنة",
        description: "تم إضافة العميل إلى جدول الشحنات اليومية",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في إضافة الشحنة",
        variant: "destructive",
      });
    },
  });

  const deleteShipmentMutation = useMutation({
    mutationFn: async (shipmentId: string) => {
      // محاكاة حذف الشحنة
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({
        title: "تم الحذف",
        description: "تم حذف الشحنة بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في حذف الشحنة",
        variant: "destructive",
      });
    },
  });

  const updateShipmentStatusMutation = useMutation({
    mutationFn: async ({ shipmentId, status }: { shipmentId: string; status: "paid" | "unpaid" }) => {
      // محاكاة تحديث حالة الدفع
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shipments"] });
      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة الدفع بنجاح",
      });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة الدفع",
        variant: "destructive",
      });
    },
  });

  const handleBarcodeScan = () => {
    if (!barcodeInput.trim()) return;
    addShipmentMutation.mutate(barcodeInput.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleBarcodeScan();
    }
  };

  const handleDeleteShipment = (shipmentId: string) => {
    if (confirm("هل أنت متأكد من حذف هذه الشحنة؟")) {
      deleteShipmentMutation.mutate(shipmentId);
    }
  };

  const handleStatusChange = (shipmentId: string, status: "paid" | "unpaid") => {
    updateShipmentStatusMutation.mutate({ shipmentId, status });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "unpaid":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "paid":
        return "دفع";
      case "unpaid":
        return "لم يدفع بعد";
      default:
        return status;
    }
  };

  const printShipmentsList = () => {
    const today = new Date();
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>قائمة الشحنات اليومية</title>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              direction: rtl;
              margin: 20px;
              font-size: 14px;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 20px;
            }
            .header h1 {
              color: #333;
              margin: 0 0 10px 0;
            }
            .date {
              font-size: 16px;
              color: #666;
              margin: 10px 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 12px 8px;
              text-align: right;
            }
            th {
              background-color: #f5f5f5;
              font-weight: bold;
              color: #333;
            }
            .status-paid {
              background-color: #d4edda;
              color: #155724;
              padding: 4px 8px;
              border-radius: 4px;
              display: inline-block;
            }
            .status-unpaid {
              background-color: #f8d7da;
              color: #721c24;
              padding: 4px 8px;
              border-radius: 4px;
              display: inline-block;
            }
            .summary {
              margin-top: 20px;
              background-color: #f8f9fa;
              padding: 15px;
              border-radius: 8px;
            }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>قائمة الشحنات اليومية</h1>
            <div class="date">
              التاريخ الميلادي: ${today.toLocaleDateString('en-GB')} - ${today.toLocaleDateString('ar-SA')}
            </div>
            <div class="date">
              الوقت: ${today.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>اسم العميل</th>
                <th>العنوان</th>
                <th>الهاتف</th>
                <th>حالة الدفع</th>
                <th>وقت الإضافة</th>
              </tr>
            </thead>
            <tbody>
              ${shipments.map((shipment, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${shipment.customerName}</td>
                  <td>${shipment.address}</td>
                  <td>${shipment.phone || 'غير محدد'}</td>
                  <td>
                    <span class="status-${shipment.status}">
                      ${getStatusText(shipment.status)}
                    </span>
                  </td>
                  <td>${new Date(shipment.createdAt).toLocaleString('ar-SA')}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <h3>ملخص الشحنات:</h3>
            <p><strong>إجمالي الشحنات:</strong> ${shipments.length}</p>
            <p><strong>تم الدفع:</strong> ${shipments.filter(s => s.status === 'paid').length}</p>
            <p><strong>لم يدفع بعد:</strong> ${shipments.filter(s => s.status === 'unpaid').length}</p>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            جدول الشحنات اليومية
            <Badge variant="secondary">{shipments.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={printShipmentsList}
              className="flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              طباعة القائمة
            </Button>
            <div className="relative max-w-xs">
              <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="البحث في الشحنات..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-10 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={() => setShowBarcodeScanner(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <QrCode className="h-4 w-4 ml-1" />
              مسح باركود
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-12 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              لا توجد شحنات اليوم
            </h3>
            <p className="text-slate-600 mb-4">
              ابدأ بمسح باركود عنوان العميل لإضافة شحنة جديدة
            </p>
            <Button
              onClick={() => setShowBarcodeScanner(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <QrCode className="h-4 w-4 ml-2" />
              مسح باركود العنوان
            </Button>
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-right font-semibold">اسم العميل</TableHead>
                  <TableHead className="text-right font-semibold">العنوان</TableHead>
                  <TableHead className="text-right font-semibold">الهاتف</TableHead>
                  <TableHead className="text-right font-semibold">حالة الدفع</TableHead>
                  <TableHead className="text-right font-semibold">وقت الإضافة</TableHead>
                  <TableHead className="text-right font-semibold">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shipments.map((shipment) => (
                  <TableRow key={shipment.id} className="hover:bg-slate-50/50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-100 rounded">
                          <Truck className="h-3 w-3 text-green-600" />
                        </div>
                        <span className="font-medium">{shipment.customerName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-slate-600 line-clamp-2 max-w-[200px]">
                        {shipment.address}
                      </span>
                    </TableCell>
                    <TableCell>
                      {shipment.phone ? (
                        <span className="text-sm">{shipment.phone}</span>
                      ) : (
                        <span className="text-sm text-slate-400">غير محدد</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={shipment.status}
                        onValueChange={(value: "paid" | "unpaid") => 
                          handleStatusChange(shipment.id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue>
                            <Badge className={getStatusColor(shipment.status)}>
                              {getStatusText(shipment.status)}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-4 w-4 text-green-600" />
                              دفع
                            </div>
                          </SelectItem>
                          <SelectItem value="unpaid">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 text-red-600" />
                              لم يدفع بعد
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-slate-600">
                        <Calendar className="h-3 w-3" />
                        {new Date(shipment.createdAt).toLocaleTimeString("ar-SA", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteShipment(shipment.id)}
                        disabled={deleteShipmentMutation.isPending}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="حذف الشحنة"
                      >
                        {deleteShipmentMutation.isPending ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-600 border-t-transparent"></div>
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* مودال مسح الباركود */}
      <Dialog open={showBarcodeScanner} onOpenChange={setShowBarcodeScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              مسح باركود عنوان العميل
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">اسم العميل من الباركود</label>
              <div className="flex gap-2">
                <Input
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="امسح باركود العنوان أو أدخل اسم العميل..."
                  className="text-right"
                  autoFocus
                />
                <Button 
                  onClick={handleBarcodeScan}
                  disabled={!barcodeInput.trim() || addShipmentMutation.isPending}
                  size="sm"
                >
                  {addShipmentMutation.isPending ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
              <p>• امسح باركود العنوان المطبوع من جدول العملاء</p>
              <p>• أو أدخل اسم العميل يدوياً واضغط Enter</p>
              <p>• سيتم إضافة العميل إلى جدول الشحنات اليومية</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
