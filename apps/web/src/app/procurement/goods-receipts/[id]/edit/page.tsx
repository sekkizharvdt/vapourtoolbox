import EditGoodsReceiptClient from './EditGoodsReceiptClient';

// Static export placeholder — actual ID comes from pathname on the client.
export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <EditGoodsReceiptClient />;
}
