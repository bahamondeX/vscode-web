// fileUtils.js
export function getFileType(extension:string) {
	// Code file extensions
	const codeExtensions = [
		'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'less',
		'json', 'md', 'py', 'php', 'rb', 'java', 'c', 'cpp', 'h',
		'cs', 'go', 'rs', 'sh', 'bat', 'yaml', 'yml', 'xml', 'sql'
	];

	// Image file extensions
	const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];

	// Video file extensions
	const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];

	// Audio file extensions
	const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];

	// Document file extensions
	const documentExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt'];

	// Determine file type based on extension
	if (codeExtensions.includes(extension)) {
		return 'code';
	} else if (imageExtensions.includes(extension)) {
		return 'image';
	} else if (videoExtensions.includes(extension)) {
		return 'video';
	} else if (audioExtensions.includes(extension)) {
		return 'audio';
	} else if (documentExtensions.includes(extension)) {
		return 'document';
	} else {
		return 'plaintext'; // Default to plaintext for unknown types
	}
}

export function getMimeType(extension:string) {
	const mimeTypes = {
		// Images
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'png': 'image/png',
		'gif': 'image/gif',
		'svg': 'image/svg+xml',
		'webp': 'image/webp',
		'bmp': 'image/bmp',
		'ico': 'image/x-icon',

		// Videos
		'mp4': 'video/mp4',
		'webm': 'video/webm',
		'ogg': 'video/ogg',
		'mov': 'video/quicktime',
		'avi': 'video/x-msvideo',

		// Audio
		'mp3': 'audio/mpeg',
		'wav': 'audio/wav',
		'ogg': 'audio/ogg',
		'aac': 'audio/aac',
		'm4a': 'audio/mp4',

		// Documents
		'pdf': 'application/pdf',
		'doc': 'application/msword',
		'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'xls': 'application/vnd.ms-excel',
		'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'ppt': 'application/vnd.ms-powerpoint',
		'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'odt': 'application/vnd.oasis.opendocument.text',

		// Code/Text
		'js': 'text/javascript',
		'jsx': 'text/javascript',
		'ts': 'text/typescript',
		'tsx': 'text/typescript',
		'html': 'text/html',
		'css': 'text/css',
		'scss': 'text/scss',
		'less': 'text/less',
		'json': 'application/json',
		'md': 'text/markdown',
		'txt': 'text/plain',
		'xml': 'application/xml',
		'yaml': 'application/yaml',
		'yml': 'application/yaml'
	};

	return mimeTypes[extension] || 'text/plain';
}