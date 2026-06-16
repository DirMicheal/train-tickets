import json, urllib.request, time

BASE = "http://127.0.0.1:3002/api/v1"

def curl(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(BASE+path, data=data, headers=headers, method=method)
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())

r = curl("POST", "/auth/login", {"account":"13900000000","password":"Admin@123"})
token = r["data"]["accessToken"]
print("【登录】success=", r["success"])

print("\n【订单A - O202606160842490711531】")
oa = curl("GET", "/orders/O202606160842490711531", token=token)["data"]
for k in ["orderNo","status","changeStatus","changedToOrderNo","travelDate","totalAmount","fromStationName","toStationName","trainNo"]:
    print(f"  {k}: {oa.get(k)}")

if oa.get("changedToOrderNo"):
    new_no = oa["changedToOrderNo"]
    print(f"\n【改签新订单 {new_no}】")
    nb = curl("GET", "/orders/" + new_no, token=token)["data"]
    for k in ["orderNo","status","travelDate","totalAmount","trainNo"]:
        print(f"  {k}: {nb.get(k)}")
    ps = nb.get("passengers") or []
    if ps:
        print(f"  seatTypeCode: {ps[0].get('seatTypeCode')}")

print("\n【订单B - O202606160842525551038 - 执行退票】")
rf = curl("POST", "/orders/O202606160842525551038/refund", {"reason":"personal","remark":"test"}, token=token)
print("  退票申请 success=%s msg=%s" % (rf.get("success"), rf.get("message")))
if rf.get("data"):
    d = rf["data"]
    print("  status=%s refundStatus=%s" % (d.get("status"), d.get("refundStatus")))

time.sleep(4)

ob_final = curl("GET", "/orders/O202606160842525551038", token=token)["data"]
print("  退票后状态:")
for k in ["orderNo","status","refundStatus","refundAmount","refundedAt","refundReason"]:
    print(f"    {k}: {ob_final.get(k)}")

print("\n【我的订单列表 - 最近5条】")
my = curl("GET", "/orders/my?page=1&pageSize=5", token=token)["data"]
for o in my["list"]:
    print("  %s | %6s | %20s | %s->%s | ¥%s" % (
        o["orderNo"], o["trainNo"], o["status"],
        o["fromStationName"], o["toStationName"], o["totalAmount"]))

print("\n=== 全流程验证完成 ===")
print("Swagger: http://127.0.0.1:3002/api/docs")
