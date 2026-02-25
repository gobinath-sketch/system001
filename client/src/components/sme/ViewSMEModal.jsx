import { X, FileText, Building, User, MapPin, Phone, Mail, Award, CreditCard, Briefcase, Home } from 'lucide-react';
import ProfileIcon from '../common/ProfileIcon';
import { API_BASE } from '../../config/api';
const LabelValue = ({
    label,
    value,
    icon: Icon
}) => <div className="flex items-start gap-3">
        <div className="flex items-center gap-2 text-gray-500 text-sm uppercase font-bold w-48 shrink-0">
            {Icon && <Icon size={16} className="text-gray-400" />}
            <span>{label}</span>
        </div>
        <span className="text-gray-400 shrink-0 text-base">-</span>
        <span className="text-gray-900 font-bold text-base flex-1 break-words">
            {value || '-'}
        </span>
    </div>;
const ViewSMEModal = ({
    isOpen,
    onClose,
    sme
}) => {
    if (!isOpen || !sme) return null;
    const toPublicPath = p => {
        const normalized = String(p || '').replace(/\\/g, '/');
        const uploadsIndex = normalized.toLowerCase().indexOf('/uploads/');
        if (uploadsIndex >= 0) {
            return normalized.slice(uploadsIndex + 1);
        }
        return normalized.replace(/^\/+/, '');
    };
    const renderDocumentLink = (path, label) => {
        const isUploaded = !!path;
        return <div className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${isUploaded ? 'bg-blue-50 border-blue-200 hover:shadow-md' : 'bg-red-50 border-red-200'}`}>
            <div className={`p-2 rounded-full ${isUploaded ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'}`}>
                <FileText size={20} />
            </div>
            <div className="flex flex-col">
                <span className="text-sm font-bold text-gray-500 uppercase tracking-wide">{label}</span>
                {isUploaded ? <a href={`${API_BASE}/${toPublicPath(path)}`} target="_blank" rel="noopener noreferrer" className="text-base font-bold text-blue-700 hover:text-blue-900 hover:underline">
                    View Document
                </a> : <span className="text-base font-bold text-red-600">Not Uploaded</span>}
            </div>
        </div>;
    };
    return <div className="fixed inset-0 bg-gray-500/20 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-100 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center z-10">
                <div className="flex items-center gap-3">
                    <div className={`p-3 rounded-lg ${sme.smeType === 'Company' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        <ProfileIcon size={32} />
                    </div>
                    <div className="flex flex-col gap-1">
                        <h2 className="text-2xl font-bold text-gray-900">{sme.name}</h2>
                        <p className="text-sm font-medium text-gray-500">{sme.smeType} • {sme.technology}</p>
                    </div>
                </div>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Company Details (if applicable) */}
                    {sme.smeType === 'Company' && <div className="col-span-full bg-blue-50/50 p-6 rounded-xl border border-blue-100">
                        <h3 className="font-bold text-blue-900 mb-6 flex items-center gap-2 text-xl">
                            <Building size={24} /> Company Details
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <LabelValue label="Company Name" value={sme.companyName} icon={Briefcase} />
                            <LabelValue label="Contact Number" value={sme.companyContactNumber} icon={Phone} />
                            <LabelValue label="Contact Person" value={sme.companyContactPerson} icon={User} />
                            <LabelValue label="Location" value={sme.companyLocation} icon={MapPin} />
                            <div className="md:col-span-2">
                                <LabelValue label="Address" value={sme.companyAddress} icon={Home} />
                            </div>
                        </div>
                    </div>}

                    {/* Basic Details */}
                    <div className="border border-blue-600 rounded-xl p-5">
                        <h3 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                            <User size={22} className="text-brand-blue" /> SME Information
                        </h3>
                        <div className="grid grid-cols-1 gap-x-4">
                            <LabelValue label="Email" value={sme.email} icon={Mail} />
                            <LabelValue label="Contact" value={sme.contactNumber} icon={Phone} />
                            <LabelValue label="Experience" value={`${sme.yearsExperience} Years`} icon={Award} />
                            <LabelValue label="Location" value={sme.location} icon={MapPin} />
                            {sme.smeType === 'Freelancer' && <LabelValue label="Address" value={sme.address} icon={MapPin} />}
                        </div>
                    </div>

                    {/* Bank & Tax Details */}
                    <div className="border border-blue-600 rounded-xl p-5">
                        <h3 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                            <CreditCard size={22} className="text-brand-blue" /> Bank & Tax Details
                        </h3>
                        <div className="grid grid-cols-1 gap-x-4">
                            <LabelValue label="Bank Name" value={sme.bankDetails?.bankName} />
                            <LabelValue label="Account No" value={sme.bankDetails?.accountNumber} />
                            <LabelValue label="IFSC Code" value={sme.bankDetails?.ifscCode} />
                            <LabelValue label="GST Number" value={sme.gstNo} />
                            <LabelValue label="PAN Number" value={sme.panNo} />
                        </div>
                    </div>
                </div>

                {/* Documents */}
                <div className="mt-8">
                    <h3 className="text-xl font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4 flex items-center gap-2">
                        <FileText size={22} className="text-brand-blue" /> Documents
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renderDocumentLink(sme.sowDocument, 'SOW Document')}
                        {renderDocumentLink(sme.ndaDocument, 'NDA Document')}
                        {renderDocumentLink(sme.sme_profile || sme.contentUpload, 'Profile')}
                        {renderDocumentLink(sme.idProof, 'ID Proof')}
                        {renderDocumentLink(sme.gstDocument, 'GST Certificate')}
                        {renderDocumentLink(sme.panDocument, 'PAN Card')}
                    </div>
                </div>
            </div>
        </div>
    </div>;
};
export default ViewSMEModal;
