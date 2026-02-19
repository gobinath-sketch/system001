import { useState } from 'react';
import { FileText, Maximize2, X, Check, FileCheck, Banknote, ArrowUpRight } from 'lucide-react';
const DocumentStatusCard = ({
  opportunities
}) => {
  const [showModal, setShowModal] = useState(false);

  // Calculate Counts
  const totalOpps = opportunities.length;
  const poCount = opportunities.filter(o => o.poDocument).length;
  const invoiceCount = opportunities.filter(o => o.invoiceDocument).length;

  // Derived stats
  const pendingPO = totalOpps - poCount;
  const pendingInvoice = totalOpps - invoiceCount;

  // Assumes 2 docs per opp (PO + Inv) for total status tracking
  const totalDocsRequired = totalOpps * 2;
  const processedDocs = poCount + invoiceCount;
  const pendingDocs = totalDocsRequired - processedDocs;
  return <>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full">
                {/* Header */}
                <div className="bg-primary-blue p-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/20 rounded-lg">
                            <FileText size={20} className="text-white" />
                        </div>
                        <h3 className="font-bold text-lg">Document Status</h3>
                    </div>
                    <button onClick={() => setShowModal(true)} className="flex items-center gap-1 text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition-colors">
                        <Maximize2 size={12} /> Expand View
                    </button>
                </div>

                {/* Body */}
                <div className="p-4 grid grid-cols-2 gap-3 flex-1">
                    {/* PO Card */}
                    <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-blue-600 rounded-lg text-white">
                                <Banknote size={18} />
                            </div>
                            <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Active</span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 font-medium mb-1">Purchase Orders</p>
                            <p className="text-3xl font-bold text-gray-800">{poCount} <span className="text-xs font-normal text-gray-500">PO</span></p>
                            <p className="text-xs text-green-600 font-medium mt-2 flex items-center">
                                <ArrowUpRight size={12} className="mr-1" /> {pendingPO} pending
                            </p>
                        </div>
                    </div>

                    {/* Invoice Card */}
                    <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-2">
                            <div className="p-2 bg-indigo-600 rounded-lg text-white">
                                <FileCheck size={18} />
                            </div>
                            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Active</span>
                        </div>
                        <div>
                            <p className="text-sm text-gray-600 font-medium mb-1">Invoices</p>
                            <p className="text-3xl font-bold text-gray-800">{invoiceCount} <span className="text-xs font-normal text-gray-500">Inv</span></p>
                            <p className="text-xs text-green-600 font-medium mt-2 flex items-center">
                                <ArrowUpRight size={12} className="mr-1" /> {pendingInvoice} pending
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 grid grid-cols-4 gap-4">
                    <div className="border-r border-gray-200">
                        <p className="text-2xl font-bold text-gray-800">{totalDocsRequired}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Total</p>
                    </div>
                    <div className="border-r border-gray-200">
                        <p className="text-2xl font-bold text-green-600">{processedDocs}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Processed</p>
                    </div>
                    <div>
                        <p className="text-2xl font-bold text-orange-500">{pendingDocs}</p>
                        <p className="text-[10px] text-gray-500 uppercase font-semibold tracking-wider">Pending</p>
                    </div>
                    <div className="flex flex-col items-end justify-center text-right pl-2">
                        <p className="text-xs text-gray-400">Last Updated</p>
                        <p className="text-xs font-medium text-gray-600">Just now</p>
                    </div>
                </div>
            </div>

            {/* Expand Modal */}
            {showModal && <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-xl font-bold text-gray-800">Document Status Overview</h2>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="overflow-auto p-6 flex-1">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-200">
                                        <th className="py-3 px-4 font-semibold text-gray-600">Opportunity ID</th>
                                        <th className="py-3 px-4 font-semibold text-gray-600">Client</th>
                                        <th className="py-3 px-4 font-semibold text-gray-600 text-center">PO Status</th>
                                        <th className="py-3 px-4 font-semibold text-gray-600 text-center">Invoice Status</th>
                                        <th className="py-3 px-4 font-semibold text-gray-600">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {opportunities.map(opp => <tr key={opp._id} className="border-b border-gray-100 hover:bg-gray-50">
                                            <td className="py-3 px-4 font-mono text-brand-blue">{opp.opportunityNumber}</td>
                                            <td className="py-3 px-4 text-gray-800">{opp.clientName}</td>
                                            <td className="py-3 px-4 text-center">
                                                {opp.poDocument ? <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                        <Check size={12} className="mr-1" /> Uploaded
                                                    </span> : <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                                        Pending
                                                    </span>}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {opp.invoiceDocument ? <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                                                        <Check size={12} className="mr-1" /> Uploaded
                                                    </span> : <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-500 text-xs font-medium">
                                                        Pending
                                                    </span>}
                                            </td>
                                            <td className="py-3 px-4">
                                                <a href={`/opportunities/${opp._id}`} className="text-brand-blue hover:underline text-sm">
                                                    View
                                                </a>
                                            </td>
                                        </tr>)}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>}
        </>;
};
export default DocumentStatusCard;