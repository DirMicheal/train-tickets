const http = require('http');

const BASE = '127.0.0.1';
const PORT = 3002;
const PREFIX = '/api/v1';

function req(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      host: BASE,
      port: PORT,
      path: PREFIX + path,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (data) opts.headers['Content-Length'] = Buffer.byteLength(data);
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    const r = http.request(opts, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch (e) { resolve({ raw: buf }); }
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  const login = await req('POST', '/auth/login', { account: '13900000000', password: 'Admin@123' });
  const token = login.data.accessToken;
  console.log('【登录】success =', login.success);

  console.log('\n【订单A - O202606160842490711531 - 改签原订单】');
  const oa = (await req('GET', '/orders/O202606160842490711531', null, token)).data;
  ['orderNo','status','changeStatus','changedToOrderNo','travelDate','totalAmount','trainNo','fromStationName','toStationName']
    .forEach(k => console.log('  ' + k + ':', oa[k]));

  if (oa.changedToOrderNo) {
    console.log('\n【改签新订单 ' + oa.changedToOrderNo + '】');
    const nb = (await req('GET', '/orders/' + oa.changedToOrderNo, null, token)).data;
    ['orderNo','status','travelDate','totalAmount','trainNo'].forEach(k => console.log('  ' + k + ':', nb[k]));
    const ps = nb.passengers || [];
    if (ps[0]) console.log('  seatTypeCode:', ps[0].seatTypeCode);
  }

  console.log('\n【订单B - O202606160842525551038 - 申请退票】');
  const rf = await req('POST', '/orders/O202606160842525551038/refund',
    { reason: 'personal', remark: 'test' }, token);
  console.log('  success:', rf.success, '| message:', rf.message);
  if (rf.data) console.log('  status=%s refundStatus=%s', rf.data.status, rf.data.refundStatus);

  await new Promise(r => setTimeout(r, 4000));

  const ob = (await req('GET', '/orders/O202606160842525551038', null, token)).data;
  console.log('  退票后状态:');
  ['orderNo','status','refundStatus','refundAmount','refundedAt','refundReason']
    .forEach(k => console.log('    ' + k + ':', ob[k]));

  console.log('\n【我的订单列表 - 最近5条】');
  const orders = (await req('GET', '/orders/my?page=1&pageSize=5', null, token)).data;
  orders.list.forEach(o => {
    console.log('  %s | %6s | %20s | %s->%s | %s元',
      o.orderNo, o.trainNo, o.status,
      o.fromStationName, o.toStationName, o.totalAmount);
  });

  console.log('\n============================================');
  console.log(' API全流程验证完成');
  console.log(' Swagger: http://127.0.0.1:3002/api/docs');
  console.log('============================================');
})().catch(e => console.error('ERR:', e));
