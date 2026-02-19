import { CheckCircle } from 'lucide-react';
import Card from '../../ui/Card';
import UploadButton from '../../ui/UploadButton';
const DeliveryDocuments = ({
  opportunity,
  canEdit,
  handleUpload,
  uploading,
  isSalesView = false
}) => {
  return <Card className="!bg-white">
            <h3 className="text-lg font-bold text-primary-blue mb-4">Delivery Documents</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['attendance', 'feedback', 'assessment', 'performance', 'contentDocument'].map(docType => <div key={docType} className="border border-gray-200 p-3 rounded-lg bg-gray-50 flex flex-col justify-between">
                        <h4 className="font-semibold text-gray-700 capitalize text-sm mb-2">{docType === 'contentDocument' ? 'Content Document' : docType}</h4>
                        <div className="flex flex-col gap-2">
                            {opportunity.deliveryDocuments?.[docType] ? <a href={`http://localhost:5000/${opportunity.deliveryDocuments[docType].replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline flex items-center text-xs font-medium">
                                    <CheckCircle size={14} className="mr-1" /> View
                                </a> : <span className="text-xs text-gray-400 italic">Not Uploaded</span>}

                            {canEdit && !isSalesView && <div className="relative mt-1">
                                    <input type="file" id={`doc-upload-${docType}`} className="hidden" onChange={e => handleUpload(e, docType)} accept=".pdf,.doc,.docx,.xlsx" disabled={uploading} />
                                    <UploadButton onClick={() => document.getElementById(`doc-upload-${docType}`).click()} disabled={uploading} className="w-full"
            // variant="primary" // Default is primary (Blue), removed conditional warning color
            >
                                        {opportunity.deliveryDocuments?.[docType] ? 'Replace' : 'Upload'}
                                    </UploadButton>
                                </div>}
                        </div>
                    </div>)}
            </div>
        </Card>;
};
export default DeliveryDocuments;