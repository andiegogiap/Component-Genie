
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { generateComponent } from './services/geminiService';

// --- TYPES ---
type PanelSizes = [number, number, number];

// Replaces GitHubFile and related types for local file management
interface FileNode {
    type: 'file' | 'dir';
    name: string;
    path: string;
    content?: string; // Content for files
    children?: FileNode[]; // Children for directories
    isOpen?: boolean; // UI state for directories
}
type SelectedFile = FileNode;


// --- ICONS ---
const MagicWandIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M5 3v4"></path><path d="M19 17v4"></path><path d="M3 5h4"></path><path d="M17 19h4"></path><path d="M12 3v18"></path><path d="m19 21-7-7-7 7"></path><path d="m5 3-3-3"></path><path d="m19 21 3 3"></path><path d="m5 3 3 3"></path><path d="m19 21-3-3"></path><path d="M12 3h.01"></path><path d="M12 19h.01"></path></svg>);
const LogoIcon = () => (
    <a href="/" aria-label="Home">
      <img
        src="https://andiegogiap.com/assets/aionex-icon-256.png"
        alt="AIONEX"
        width="128"
        height="128"
        style={{
          height: '40px',
          width: 'auto',
          display: 'block',
          filter: 'drop-shadow(0 0 5px var(--neon-blue))'
        }}
        loading="eager"
        decoding="async"
      />
    </a>
);
const FolderIcon = ({ isOpen }: { isOpen?: boolean }) => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={isOpen ? "M20 12.5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1 0-1h15.5a.5.5 0 0 1 .5.5z" : "M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"}></path></svg>);
const FileIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>);
const SaveIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>);
const DownloadIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>);


// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component<{ children: React.ReactNode, onRenderError: (error: Error) => void }, { hasError: boolean }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) { this.props.onRenderError(error); console.error("Dynamic component render error:", error, errorInfo); }
  componentDidUpdate(prevProps: any) { if (prevProps.children !== this.props.children) { this.setState({ hasError: false }); } }
  render() {
    if (this.state.hasError) {
      return (<div className="p-4 flex flex-col items-center justify-center h-full text-center"><p className="text-[var(--neon-pink)] font-semibold text-lg" style={{textShadow: '0 0 5px var(--neon-pink)'}}>Component Render Error</p><p className="text-xs text-gray-400 mt-1">Check the browser console for details.</p></div>);
    }
    return this.props.children;
  }
}

// --- SUB-COMPONENTS ---
const DynamicComponentRenderer = ({ code, onRenderError }: { code: string; onRenderError: (error: Error) => void }) => {
    const [Component, setComponent] = useState<React.ComponentType | null>(null);
    const [transpilationError, setTranspilationError] = useState<string | null>(null);
    
    useEffect(() => {
        if (!code) { setComponent(null); setTranspilationError(null); return; }
        try {
            // @ts-ignore
            const transformedCode = window.Babel.transform(code, { presets: ["react"] }).code;
            const cleanCode = transformedCode.replace(/^'use strict';\n?/, '');
            const componentNameMatch = cleanCode.match(/^(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=/);
            const functionBody = componentNameMatch ? `${cleanCode}\nreturn ${componentNameMatch[1]};` : `return (${cleanCode})`;
            const componentFunction = new Function('React', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef', functionBody);
            const NewComponent = componentFunction(React, React.useState, React.useEffect, React.useCallback, React.useMemo, React.useRef);
            setComponent(() => NewComponent);
            setTranspilationError(null);
        } catch (e: unknown) {
            if (e instanceof Error) { console.error("Babel/Function execution error:", e); setTranspilationError(e.message); }
            setComponent(null);
        }
    }, [code]);

    if (transpilationError) return <div className="p-4 text-[var(--neon-pink)] font-mono text-xs"><p className="font-bold mb-2">Transpilation Failed:</p>{transpilationError}</div>;
    if (Component) return <ErrorBoundary onRenderError={onRenderError}><Component /></ErrorBoundary>;
    return null;
};

const CliLoader = () => (
    <div className="p-4 font-mono text-sm text-[var(--text-light)]">
      <div>&gt; Running gemini build...</div>
      <div className="flex items-center text-[var(--neon-green)]" style={{textShadow: '0 0 5px var(--neon-green)'}}>
        &gt; Generating component...<div className="w-2 h-4 bg-[var(--neon-green)] ml-2 animate-pulse"></div>
      </div>
    </div>
);

const FileTree = ({ node, onSelectFile, onToggleDir, level = 0 }: { node: FileNode, onSelectFile: (file: FileNode) => void, onToggleDir: (dir: FileNode) => void, level?: number }) => {
    const isDir = node.type === 'dir';
    const paddingLeft = `${level * 1.25}rem`;
    const sortedChildren = node.children?.sort((a, b) => { if (a.type === b.type) return a.name.localeCompare(b.name); return a.type === 'dir' ? -1 : 1; });
    return (
        <div>
            <div onClick={() => (isDir ? onToggleDir(node) : onSelectFile(node))} className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-[var(--neon-purple)]/20 rounded-md text-sm transition-colors duration-200" style={{ paddingLeft }}>
                <span className="text-[var(--neon-purple)]">{isDir ? <FolderIcon isOpen={node.isOpen} /> : <FileIcon />}</span>
                <span>{node.name}</span>
            </div>
            {isDir && node.isOpen && sortedChildren?.map(child => (<FileTree key={child.path} node={child} onSelectFile={onSelectFile} onToggleDir={onToggleDir} level={level + 1} />))}
        </div>
    );
};

const categorizedPrompts = {
    'UI Elements': [
      'A sleek, dark-themed pricing table with three tiers.',
      'A user profile card with an avatar, name, username, and a "Follow" button.',
      'A star rating component that allows users to select a rating from 1 to 5.',
      'A cookie consent banner that is fixed to the bottom of the page.',
    ],
    'Layout & Navigation': [
      'A responsive hero section with a centered heading, a subheading, and a call-to-action button.',
      'A navigation bar with a logo, links, and a search bar.',
      'An image gallery with a masonry layout.',
      'A sidebar navigation menu that is collapsible.',
    ],
    'Interactive Components (React)': [
      'A simple todo list application UI with an input field to add tasks and a list to display them.',
      'A custom hook `useDebounce` to limit how often a function is called.',
      'An autocomplete search input that fetches suggestions from a mock API.',
      'A multi-step form with validation and a summary page.',
    ],
    'shadcn/ui Inspired': [
      'A command palette (like CMD+K) for searching actions or files.',
      'A toast notification system that can display success, error, and info messages.',
      'A calendar component with date picking capabilities.',
      'An accordion component for creating FAQ sections.',
    ],
    'Full Web Apps (Vue/Vite/Node UI)': [
      'Recreate the Vue.js homepage hero section in React and Tailwind.',
      'A dashboard UI to monitor a Vite build process, showing status and output logs.',
      'A UI for displaying server statistics from a Node.js backend, with charts for CPU and memory usage.',
      'A simple blog layout with a list of posts and a detail view.'
    ]
};

const SamplePrompts = ({ onSelect }: { onSelect: (prompt: string) => void }) => (
    <div className="border-t-2 border-[var(--neon-purple)]/30 pt-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--neon-purple)]/80 px-4 py-2" style={{textShadow: '0 0 2px var(--neon-purple)'}}>
            Or try a sample
        </h3>
        <div className="px-4 pb-3 space-y-4">
            {Object.entries(categorizedPrompts).map(([category, prompts]) => (
                <div key={category}>
                    <h4 className="font-bold text-sm text-gray-300 mb-2">{category}</h4>
                    <blockquote className="border-l-2 border-[var(--neon-purple)]/50 pl-3 space-y-2">
                        {prompts.map((prompt) => (
                             <button
                                key={prompt}
                                onClick={() => onSelect(prompt)}
                                className="w-full text-left text-xs px-3 py-1.5 bg-transparent border border-transparent rounded-md hover:bg-[var(--neon-purple)]/20 hover:border-[var(--neon-purple)]/40 transition-all duration-200 neon-focus-ring"
                            >
                                {prompt}
                            </button>
                        ))}
                    </blockquote>
                </div>
            ))}
        </div>
    </div>
);

const OrbMenu = ({ onGenerate, onSave, onExport, isSavable, isGeneratable, isExportable }: { onGenerate: () => void, onSave: () => void, onExport: () => void, isSavable: boolean, isGeneratable: boolean, isExportable: boolean }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col items-center gap-3">
             {isOpen && (
                <div className="flex flex-col gap-3 p-3 bg-[var(--panel-grey-translucent)] backdrop-blur-md rounded-lg border border-[var(--neon-pink)]/50 shadow-[0_0_15px_var(--neon-pink)]">
                    <button onClick={() => { onGenerate(); setIsOpen(false); }} disabled={!isGeneratable} className="w-full text-center px-4 py-2 text-sm font-bold text-[var(--neon-blue)] uppercase tracking-wider bg-transparent border-2 border-[var(--neon-blue)] rounded-md transition-all duration-300 hover:bg-[var(--neon-blue)] hover:text-[var(--text-dark)] hover:shadow-[0_0_15px_var(--neon-blue)] disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed">Generate</button>
                    <button onClick={() => { onSave(); setIsOpen(false); }} disabled={!isSavable} className="w-full text-center px-4 py-2 text-sm font-bold text-[var(--neon-green)] uppercase tracking-wider bg-transparent border-2 border-[var(--neon-green)] rounded-md transition-all duration-300 hover:bg-[var(--neon-green)] hover:text-[var(--text-dark)] hover:shadow-[0_0_15px_var(--neon-green)] disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed">Save</button>
                    <button onClick={() => { onExport(); setIsOpen(false); }} disabled={!isExportable} className="w-full text-center px-4 py-2 text-sm font-bold text-[var(--neon-pink)] uppercase tracking-wider bg-transparent border-2 border-[var(--neon-pink)] rounded-md transition-all duration-300 hover:bg-[var(--neon-pink)] hover:text-[var(--text-dark)] hover:shadow-[0_0_15px_var(--neon-pink)] disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed">Export JSON</button>
                </div>
            )}
            <button onClick={() => setIsOpen(!isOpen)} className="w-16 h-16 rounded-full bg-[var(--neon-purple)] flex items-center justify-center text-white cursor-pointer animate-pulse" style={{ animation: 'pulse 2s infinite' }}>
                <MagicWandIcon />
            </button>
        </div>
    );
};

const defaultComponentContent = `
const WelcomeComponent = () => {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-gray-900/50 rounded-lg">
            <h1 className="text-3xl font-bold text-[var(--neon-blue)]" style={{textShadow: '0 0 8px var(--neon-blue)'}}>Welcome to Component Genie</h1>
            <p className="mt-4 text-lg text-gray-300">Describe a component in the prompt box on the left, then click 'Generate' to see the magic.</p>
            <p className="mt-2 text-sm text-gray-500">You can edit the code in the right-hand panel and see your changes live in this preview panel.</p>
        </div>
    );
};
`;

const initialFileTree: FileNode = {
    name: "src",
    path: "src",
    type: "dir",
    isOpen: true,
    children: [
        {
            name: "WelcomeComponent.jsx",
            path: "src/WelcomeComponent.jsx",
            type: "file",
            content: defaultComponentContent
        }
    ]
};

export const App = () => {
    const [prompt, setPrompt] = useState<string>("A login form with email, password, and a 'Forgot Password' link.");
    const [editorContent, setEditorContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [renderError, setRenderError] = useState<string | null>(null);
    
    const [fileTree, setFileTree] = useState<FileNode>(initialFileTree);
    const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    const [panelSizes, setPanelSizes] = useState<PanelSizes>([25, 50, 25]);
    const resizingRef = useRef<{ isResizing: boolean, handleIndex: number | null }>({ isResizing: false, handleIndex: null });
    const containerRef = useRef<HTMLDivElement>(null);

    const handleSelectFile = useCallback((file: FileNode) => {
        if (file.type === 'file') {
            setError(null);
            setSelectedFile(file);
            setEditorContent(file.content || '');
        }
    }, []);

    useEffect(() => {
        const firstFile = initialFileTree.children?.find(c => c.type === 'file');
        if (firstFile) {
            handleSelectFile(firstFile);
        }
    }, [handleSelectFile]);


    const handleGenerate = useCallback(async () => {
        if (!prompt || isLoading) return;
        setIsLoading(true); setError(null); setRenderError(null);
        try {
            const code = await generateComponent(prompt);
            
            const allFilePaths = new Set<string>();
            const collectPaths = (node: FileNode) => {
                allFilePaths.add(node.path);
                if (node.children) node.children.forEach(collectPaths);
            };
            if(fileTree) collectPaths(fileTree);

            let newFileName = "GeneratedComponent.jsx";
            let counter = 1;
            while (allFilePaths.has(`src/${newFileName}`)) {
                newFileName = `GeneratedComponent${counter++}.jsx`;
            }

            const newFile: FileNode = {
                name: newFileName,
                path: `src/${newFileName}`,
                type: 'file',
                content: code,
            };
            
            setFileTree(currentTree => {
                const newChildren = [...(currentTree.children || []), newFile];
                return { ...currentTree, children: newChildren, isOpen: true };
            });

            setSelectedFile(newFile);
            setEditorContent(code);

        } catch (e: unknown) { if (e instanceof Error) setError(e.message); } 
        finally { setIsLoading(false); }
    }, [prompt, isLoading, fileTree]);


    const handleToggleDir = useCallback((dirNode: FileNode) => {
        const toggle = (node: FileNode): FileNode => {
            if (node.path === dirNode.path && node.type === 'dir') {
                return { ...node, isOpen: !node.isOpen };
            }
            if (node.children) {
                return { ...node, children: node.children.map(toggle) };
            }
            return node;
        };
        if (fileTree) { setFileTree(toggle(fileTree)); }
    }, [fileTree]);
    
    const handleSave = async () => {
        if (!selectedFile) { setError("No file selected to save."); return; }
        setSaveStatus('saving'); setError(null);
        
        const updateFileInTree = (node: FileNode): FileNode => {
            if (node.path === selectedFile.path) {
                return { ...node, content: editorContent };
            }
            if (node.children) {
                return { ...node, children: node.children.map(updateFileInTree) };
            }
            return node;
        };
        
        setFileTree(updateFileInTree(fileTree));
        setSelectedFile(prev => prev ? { ...prev, content: editorContent } : null);

        setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 500);
    };

    const handleExportJson = useCallback(() => {
        if (!selectedFile || editorContent === null) {
            setError("No component to export.");
            return;
        }
        try {
            const jsonOutput = {
                componentName: selectedFile.name,
                code: editorContent,
            };
            const jsonString = JSON.stringify(jsonOutput, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedFile.name.replace(/\.(jsx|tsx)$/, '')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setError(null);
        } catch (err) {
            console.error("Failed to export JSON:", err);
            const message = err instanceof Error ? err.message : "An unknown error occurred";
            setError(`Failed to export: ${message}`);
        }
    }, [selectedFile, editorContent]);

    const handleMouseDown = (e: React.MouseEvent, index: number) => { resizingRef.current = { isResizing: true, handleIndex: index }; };
    const handleMouseUp = useCallback(() => { resizingRef.current = { isResizing: false, handleIndex: null }; }, []);
    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!resizingRef.current.isResizing || resizingRef.current.handleIndex === null || !containerRef.current) return;
        const handleIndex = resizingRef.current.handleIndex;
        const { left, width } = containerRef.current.getBoundingClientRect();
        const newX = Math.max(0, Math.min(e.clientX - left, width));
        let newSizes = [...panelSizes];
        const minPanelSize = 10;
        if (handleIndex === 0) {
            const combined = newSizes[0] + newSizes[1];
            let panel0Size = Math.min(Math.max((newX / width) * 100, minPanelSize), combined - minPanelSize);
            newSizes[0] = panel0Size;
            newSizes[1] = combined - panel0Size;
        } else if (handleIndex === 1) {
            const combined = newSizes[1] + newSizes[2];
            let panel1Size = Math.min(Math.max(((newX / width) * 100) - newSizes[0], minPanelSize), combined - minPanelSize);
            newSizes[1] = panel1Size;
            newSizes[2] = combined - panel1Size;
        }
        setPanelSizes(newSizes.map(s => Math.round(s * 100) / 100) as PanelSizes);
    }, [panelSizes]);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
    }, [handleMouseMove, handleMouseUp]);

    const handleRenderError = useCallback((err: Error) => setRenderError(`Render Error: ${err.message}`), []);
    
    const handleEditorMount: OnMount = (editor, monaco) => {
        monaco.editor.defineTheme('dark-transparent', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#00000000',
            },
        });
    };

    const isDirty = selectedFile?.content !== editorContent;
    const isSaveDisabled = !selectedFile || !isDirty || saveStatus !== 'idle';


    return (
        <div className="flex flex-col h-screen antialiased font-sans">
            <header className="flex items-center justify-between p-3 bg-[var(--dark-grey)]/80 backdrop-blur-sm z-20" style={{boxShadow: '0 2px 20px -3px var(--neon-blue)'}}>
                <div className="flex items-center gap-3">
                    <LogoIcon />
                    <h1 className="text-xl font-bold text-gray-200 tracking-wider">Component <span className="text-[var(--neon-blue)]">Genie</span></h1>
                </div>

                <div className="flex items-center gap-2">
                    <button id="save-btn" onClick={handleSave} disabled={isSaveDisabled} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[var(--neon-green)] uppercase tracking-wider bg-transparent border-2 border-[var(--neon-green)] rounded-md transition-all duration-300 hover:bg-[var(--neon-green)] hover:text-[var(--text-dark)] hover:shadow-[0_0_15px_var(--neon-green)] disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed"><SaveIcon />{saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : 'Save'}</button>
                    <button onClick={handleExportJson} disabled={!selectedFile} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[var(--neon-pink)] uppercase tracking-wider bg-transparent border-2 border-[var(--neon-pink)] rounded-md transition-all duration-300 hover:bg-[var(--neon-pink)] hover:text-[var(--text-dark)] hover:shadow-[0_0_15px_var(--neon-pink)] disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed"><DownloadIcon />Export JSON</button>
                    <button onClick={handleGenerate} disabled={isLoading || !prompt} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-[var(--neon-blue)] uppercase tracking-wider bg-transparent border-2 border-[var(--neon-blue)] rounded-md transition-all duration-300 hover:bg-[var(--neon-blue)] hover:text-[var(--text-dark)] hover:shadow-[0_0_15px_var(--neon-blue)] disabled:border-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed"><MagicWandIcon />{isLoading ? 'Generating...' : 'Generate'}</button>
                </div>
            </header>

            <main ref={containerRef} className="flex flex-1 overflow-hidden relative p-4 gap-4">
                {error && <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black border-2 border-[var(--neon-pink)] text-white px-4 py-2 rounded-lg text-sm z-30 font-mono shadow-[0_0_15px_var(--neon-pink)]">{error}</div>}
                
                <div className="h-full flex flex-col bg-[var(--panel-grey-translucent)] backdrop-blur-sm rounded-lg border border-[var(--neon-purple)]/30" style={{ flexBasis: `${panelSizes[0]}%` }}>
                    <div className="p-2 border-b-2 border-[var(--neon-purple)]/30"><h2 className="text-sm font-bold text-center uppercase tracking-wider text-[var(--neon-purple)]" style={{textShadow: '0 0 4px var(--neon-purple)'}}>Prompt & Files</h2></div>
                    <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Describe the component..." className="w-full p-4 bg-transparent text-[var(--text-light)] resize-none focus:outline-none font-mono text-sm h-40 neon-focus-ring"/>
                    <div className="flex-1 overflow-y-auto">
                        <SamplePrompts onSelect={setPrompt} />
                        <div className="p-2 border-y-2 border-[var(--neon-purple)]/30"><h2 className="text-sm font-bold text-center uppercase tracking-wider text-[var(--neon-purple)]" style={{textShadow: '0 0 4px var(--neon-purple)'}}>File Explorer</h2></div>
                        <div className="flex-1 p-2">{fileTree ? <FileTree node={fileTree} onSelectFile={handleSelectFile} onToggleDir={handleToggleDir} /> : <div className="text-center text-gray-500 text-sm mt-4 p-4">File explorer is loading...</div>}</div>
                    </div>
                </div>
                
                <div onMouseDown={(e) => handleMouseDown(e, 0)} className="w-1.5 h-full cursor-col-resize rounded-full bg-[var(--neon-purple)]/30 hover:bg-[var(--neon-purple)] transition-all duration-200" style={{boxShadow: '0 0 10px var(--neon-purple)'}}></div>

                <div className="h-full flex flex-col bg-[var(--panel-grey-translucent)] backdrop-blur-sm rounded-lg border border-[var(--neon-blue)]/30" style={{ flexBasis: `${panelSizes[1]}%` }}>
                   <div className="p-2 border-b-2 border-[var(--neon-blue)]/30"><h2 className="text-sm font-bold text-center uppercase tracking-wider text-[var(--neon-blue)]" style={{textShadow: '0 0 4px var(--neon-blue)'}}>Preview</h2></div>
                    <div className="flex-1 p-4 overflow-auto">{!editorContent && <div className="text-center text-gray-500">Generate a component to see a preview.</div>}{editorContent && <DynamicComponentRenderer code={editorContent} onRenderError={handleRenderError} />}</div>
                </div>
                
                <div onMouseDown={(e) => handleMouseDown(e, 1)} className="w-1.5 h-full cursor-col-resize rounded-full bg-[var(--neon-blue)]/30 hover:bg-[var(--neon-blue)] transition-all duration-200" style={{boxShadow: '0 0 10px var(--neon-blue)'}}></div>

                <div className="h-full flex flex-col bg-[var(--panel-grey-translucent)] backdrop-blur-sm rounded-lg border border-[var(--neon-green)]/30" style={{ flexBasis: `${panelSizes[2]}%` }}>
                    <div className="p-2 border-b-2 border-[var(--neon-green)]/30 flex justify-between items-center">
                      <h2 className="text-sm font-bold text-center uppercase tracking-wider text-[var(--neon-green)] flex-1" style={{textShadow: '0 0 4px var(--neon-green)'}}>Code</h2>
                      {selectedFile && <span className={`text-xs font-mono px-2 py-1 rounded ${isDirty ? 'text-[var(--neon-pink)]' : 'text-gray-400'}`} title={selectedFile.path}>{selectedFile.name}{isDirty ? '*' : ''}</span>}
                    </div>
                    <div className="flex-1 bg-transparent overflow-hidden rounded-b-lg">
                        {isLoading ? <CliLoader/> : (<Editor height="100%" language={selectedFile?.name.split('.').pop()?.startsWith('js') ? 'javascript' : 'css'} theme="dark-transparent" path={selectedFile?.path} value={editorContent} onChange={(value) => setEditorContent(value || '')} onMount={handleEditorMount} options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on', tabSize: 2 }} />)}
                    </div>
                </div>
            </main>
            <OrbMenu onGenerate={handleGenerate} onSave={handleSave} onExport={handleExportJson} isSavable={!!selectedFile && isDirty && saveStatus === 'idle'} isGeneratable={!isLoading && !!prompt} isExportable={!!selectedFile}/>
        </div>
    );
};