import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Files, Search, GitBranch, Play, Settings, ChevronRight, FileCode, X, Code2,
  CheckCircle2, AlertCircle, Layout, FileEdit, FileText, FolderOpen, FilePlus, FolderPlus, RefreshCw, Copy, Trash2, Edit2, Pin, PinOff, AlignLeft, Download, Sparkles, Bot, CloudUpload
} from 'lucide-react';
import { ChatPanel } from './components/ai/ChatPanel';
import { Auth } from './components/Auth';
import { askAI } from './services/ai';
import ReactMarkdown from 'react-markdown';
import { Editor } from '@monaco-editor/react';
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

import remarkGfm from 'remark-gfm';
import remarkEmoji from 'remark-emoji';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import GithubSlugger from 'github-slugger';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';

import html2pdf from 'html2pdf.js';
import { saveAs } from 'file-saver';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import * as htmlDocx from 'html-docx-js-typescript';
import { get, set } from 'idb-keyval';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
const WS_BASE_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/ws';


const Mermaid = ({ chart, theme }: { chart: string, theme: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    mermaid.initialize({ startOnLoad: false, theme: theme.includes('light') ? 'default' : 'dark' });
    if (containerRef.current) {
      mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, chart)
        .then((result) => {
          if (containerRef.current) {
            containerRef.current.innerHTML = result.svg;
          }
        })
        .catch(e => {
           if (containerRef.current) {
             containerRef.current.innerHTML = `<pre style="color:red">Mermaid Error: ${e.message}</pre>`;
           }
        });
    }
  }, [chart, theme]);

  return <div ref={containerRef} className="mermaid-diagram" />;
};

const AdmonitionBlockquote = ({ children, ...props }: any) => {
  const childArray = React.Children.toArray(children);
  
  const firstParagraph = childArray.find((child: any) => React.isValidElement(child) && child.type === 'p');
  if (React.isValidElement(firstParagraph) && firstParagraph.props && (firstParagraph.props as any).children) {
    const pChildren = React.Children.toArray((firstParagraph.props as any).children);
    const firstText = pChildren[0];
    
    if (typeof firstText === 'string') {
      const match = firstText.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]/i);
      if (match) {
        const type = match[1].toLowerCase();
        
        const newFirstText = firstText.replace(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION|INFO)\]\s*/i, '');
        const newPChildren = [newFirstText, ...pChildren.slice(1)];
        const newParagraph = React.cloneElement(firstParagraph as React.ReactElement, {}, newPChildren);
        const newChildren = childArray.map(child => child === firstParagraph ? newParagraph : child);
        
        const icons: Record<string, any> = {
          note: <AlertCircle size={16} />,
          info: <AlertCircle size={16} />,
          tip: <CheckCircle2 size={16} />,
          important: <AlertCircle size={16} />,
          warning: <AlertCircle size={16} />,
          caution: <AlertCircle size={16} />
        };
        
        return (
          <div className={`admonition admonition-${type}`}>
            <div className="admonition-title">
              {icons[type] || icons.note}
              {type.toUpperCase()}
            </div>
            <div className="admonition-content">
              {newChildren}
            </div>
          </div>
        );
      }
    }
  }
  
  return <blockquote {...props}>{children}</blockquote>;
};

type FileNode = {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  handle?: any;
  parentHandle?: any;
  parentId?: string | null;
  isDirty?: boolean;
  isPinned?: boolean;
};

const initialFiles: FileNode[] = [];

type InlineInputState = 
  | { type: 'new-file' | 'new-folder', targetFolderId: string, targetHandle: any }
  | { type: 'rename', node: FileNode }
  | null;

const InlineInput = ({ defaultValue, onSubmit, onCancel, icon, paddingLeft = 24 }: { defaultValue: string, onSubmit: (v: string) => void, onCancel: () => void, icon: React.ReactNode, paddingLeft?: number }) => {
  const [val, setVal] = useState(defaultValue);
  const isDone = useRef(false);

  const handleComplete = (isSubmit: boolean) => {
    if (isDone.current) return;
    isDone.current = true;
    if (isSubmit && val.trim()) {
      onSubmit(val);
    } else {
      onCancel();
    }
  };

  return (
    <div className="explorer-item" style={{ paddingLeft: `${paddingLeft}px` }} onClick={e => e.stopPropagation()}>
      {icon}
      <input
        autoFocus
        value={val}
        onChange={e => setVal(e.target.value)}
        className="explorer-inline-input"
        style={{ marginLeft: '4px' }}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); handleComplete(true); }
          else if (e.key === 'Escape') { e.preventDefault(); handleComplete(false); }
        }}
        onBlur={() => handleComplete(true)}
      />
    </div>
  );
};

const FileItem = ({ 
  node, 
  depth = 0, 
  onFileClick, 
  onContextMenu, 
  inlineInput, 
  onConfirmInput, 
  onCancelInput,
  selectedNodeId
}: { 
  node: FileNode; 
  depth?: number; 
  onFileClick: (node: FileNode) => void; 
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void;
  inlineInput: InlineInputState;
  onConfirmInput: (val: string) => void;
  onCancelInput: () => void;
  selectedNodeId: string | null;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const paddingLeft = 8 + depth * 16;
  const isFolder = node.type === 'folder';
  
  const isTargetFolder = inlineInput?.type.startsWith('new-') && (inlineInput as any).targetFolderId === node.id;

  useEffect(() => {
    if (isTargetFolder) {
      setIsOpen(true);
    }
  }, [isTargetFolder]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFolder) {
      setIsOpen(!isOpen);
    }
    onFileClick(node);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  if (inlineInput?.type === 'rename' && inlineInput.node.id === node.id) {
    return (
      <InlineInput 
        defaultValue={node.name} 
        onSubmit={onConfirmInput} 
        onCancel={onCancelInput} 
        paddingLeft={paddingLeft}
        icon={isFolder ? <ChevronRight size={16} /> : <FileCode size={16} color="#58a6ff" />} 
      />
    );
  }

  return (
    <>
      <div 
        className={`explorer-item ${selectedNodeId === node.id ? 'selected' : ''}`} 
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {isFolder ? <ChevronRight size={16} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} /> : <FileCode size={16} color="#58a6ff" />}
        <span>{node.name}</span>
      </div>
      {isFolder && isOpen && (
        <div>
          {isTargetFolder && (
             <InlineInput 
               defaultValue=""
               onSubmit={onConfirmInput}
               onCancel={onCancelInput}
               paddingLeft={paddingLeft + 16}
               icon={inlineInput && inlineInput.type === 'new-folder' ? <ChevronRight size={16} /> : <FileCode size={16} color="#58a6ff" />}
             />
          )}
          {node.children?.map(child => (
            <FileItem 
              key={child.id} 
              node={child} 
              depth={depth + 1} 
              onFileClick={onFileClick} 
              onContextMenu={onContextMenu} 
              inlineInput={inlineInput} 
              onConfirmInput={onConfirmInput} 
              onCancelInput={onCancelInput} 
              selectedNodeId={selectedNodeId}
            />
          ))}
        </div>
      )}
    </>
  );
};

type WorkspaceData = {
  id: string;
  name: string;
  folderHandles: any[];
  favoriteFiles: { id: string, name: string, handle: any, parentHandle: any }[];
  settings: any;
};

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [cloudFiles, setCloudFiles] = useState<{id: string, fileName: string, lastModified: string}[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceData[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);


  const [explorerWidth, setExplorerWidth] = useState(260);
  const [files, setFiles] = useState<FileNode[]>(initialFiles);
  const [openFiles, setOpenFiles] = useState<FileNode[]>([]);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  
  const [recentFiles, setRecentFiles] = useState<FileNode[]>([]);
  const [, setClosedTabs] = useState<FileNode[]>([]);
  
  const [rootDirHandle, setRootDirHandle] = useState<any>(null); // Kept for fallback/compat
  const [rootDirName, setRootDirName] = useState<string>('WORKSPACE');

  
  // Selection state for Explorer
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  
  type ViewMode = 'markdown' | 'preview' | 'split';
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [activeSidebar, setActiveSidebar] = useState<'explorer' | 'search' | 'outline' | 'ai'>('explorer');
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  const [inlineInput, setInlineInput] = useState<InlineInputState>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [searchRegex, setSearchRegex] = useState(false);
  const [searchCaseSensitive, setSearchCaseSensitive] = useState(false);
  const [searchWholeWord, setSearchWholeWord] = useState(false);
  const [searchResults, setSearchResults] = useState<{ file: FileNode; matchName: boolean; snippets: { line: number, text: string }[]; content: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Outline State
  type OutlineItem = { level: number, title: string, id: string, line: number };
  const [outline, setOutline] = useState<OutlineItem[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [collapsedOutline, setCollapsedOutline] = useState<Set<string>>(new Set());

  const [theme, setTheme] = useState('github-dark');
  const [cursorPos, setCursorPos] = useState({ line: 1, column: 1 });
  
  type ContextMenuData = { x: number, y: number, file: FileNode, type: 'explorer' | 'tab' };
  const [contextMenu, setContextMenu] = useState<ContextMenuData | null>(null);

  const activeFileIdRef = useRef(activeFileId);
  activeFileIdRef.current = activeFileId;
  const openFilesRef = useRef(openFiles);
  openFilesRef.current = openFiles;
  const rootDirHandleRef = useRef(rootDirHandle);
  rootDirHandleRef.current = rootDirHandle;
  const editorRef = useRef<any>(null);

  // WebSocket Collaboration State
  const wsRef = useRef<WebSocket | null>(null);
  const isUpdatingFromWs = useRef(false);
  const [liveShareMode, setLiveShareMode] = useState<'none' | 'host' | 'guest'>('none');
  const [roomId, setRoomId] = useState<string | null>(null);
  const [pendingGuests, setPendingGuests] = useState<string[]>([]);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connectWs = () => {
      ws = new WebSocket(WS_BASE_URL);
      
      ws.onopen = () => console.log('🔗 Connected to Go Collaboration Server!');

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'room-created') {
            setRoomId(data.roomId);
            setLiveShareMode('host');
          } else if (data.type === 'guest-waiting') {
            setPendingGuests(prev => [...prev, data.guestId]);
          } else if (data.type === 'guest-joined') {
            const content = openFilesRef.current.find(f => f.id === activeFileIdRef.current)?.content;
            if (content) {
              ws.send(JSON.stringify({ type: 'sync-content', content }));
            }
          } else if (data.type === 'join-accepted') {
            setLiveShareMode('guest');
            setRoomId(data.roomId);
          } else if (data.type === 'join-rejected') {
            alert('Host rejected your join request.');
          } else if (data.type === 'update-content') {
            isUpdatingFromWs.current = true;
            setOpenFiles(prev => {
              const exists = prev.find(f => f.id === activeFileIdRef.current);
              if (exists) {
                 return prev.map(f => f.id === activeFileIdRef.current ? { ...f, content: data.content } : f);
              }
              const guestFile = { id: 'shared-file', name: 'Shared Document', type: 'file' as const, content: data.content };
              return [...prev, guestFile];
            });
            if (activeFileIdRef.current === null) {
              setActiveFileId('shared-file');
            }
            setTimeout(() => { isUpdatingFromWs.current = false; }, 50);
          } else if (data.type === 'error') {
            alert(data.content);
          } else if (data.type === 'room-closed') {
            alert('The host closed the room.');
            setLiveShareMode('none');
            setRoomId(null);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        console.log('❌ Disconnected from Go server. Reconnecting in 3s...');
        reconnectTimer = setTimeout(connectWs, 3000);
      };

      wsRef.current = ws;
    };

    connectWs();

    return () => {
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null; // Prevent reconnect loop on unmount
        ws.close();
      }
    };
  }, []);

  const hostSession = () => {
    if (!wsRef.current) {
      alert("WebSocket is not initialized.");
      return;
    }
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      alert(`WebSocket is not fully connected yet (state: ${wsRef.current.readyState}). Try again in a second.`);
      return;
    }
    try {
      wsRef.current.send(JSON.stringify({ type: 'host-room' }));
    } catch (err: any) {
      alert("Error sending host request: " + err.message);
    }
  };

  const joinSession = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert("WebSocket is not fully connected yet. Try again in a second.");
      return;
    }
    const id = prompt("Enter Room ID to join:");
    if (id) {
      wsRef.current.send(JSON.stringify({ type: 'join-room', roomId: id }));
    }
  };

  const acceptGuest = (guestId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'accept-guest', guestId }));
    }
    setPendingGuests(prev => prev.filter(id => id !== guestId));
  };
  
  const rejectGuest = (guestId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reject-guest', guestId }));
    }
    setPendingGuests(prev => prev.filter(id => id !== guestId));
  };


  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
  }, [theme]);
  
  const isResizing = useRef(false);

  const saveFile = async (fileNode: FileNode) => {
    let localSaved = false;
    // Save locally if file handle exists
    if (fileNode.handle) {
      try {
        const writable = await fileNode.handle.createWritable();
        await writable.write(fileNode.content || '');
        await writable.close();
        localSaved = true;
      } catch (err) {
        console.error('Local save failed:', err);
      }
    }

    // Also save to cloud (B2 via backend)
    const token = authToken || localStorage.getItem('token');
    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/files/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ fileName: fileNode.name, content: fileNode.content || '' }),
        });
        if (!res.ok) {
          const errData = await res.json();
          console.error('Cloud save failed:', errData.error);
        } else {
          console.log(`☁️ Saved ${fileNode.name} to cloud`);
        }
      } catch (err) {
        console.error('Cloud save error:', err);
      }
    }

    return localSaved || !!token;
  };

  // Fetch user's files from cloud on login
  const fetchUserFiles = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/files`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      // Map MongoDB _id to id for consistent frontend usage
      const mapped = (data.files || []).map((f: any) => ({
        id: f._id || f.id,
        fileName: f.fileName,
        lastModified: f.lastModified || f.updatedAt,
      }));
      setCloudFiles(mapped);
    } catch (err) {
      console.error('Failed to fetch cloud files:', err);
    }
  };

  // Open a cloud file by fetching its content from B2
  const openCloudFile = async (fileId: string, fileName: string) => {
    const token = authToken || localStorage.getItem('token');
    if (!token) {
      console.error('No auth token — cannot open cloud file');
      return;
    }
    // If this file is already open, just switch to it
    const existingId = `cloud-${fileId}`;
    const alreadyOpen = openFiles.find(f => f.id === existingId);
    if (alreadyOpen) {
      setActiveFileId(existingId);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/files/${fileId}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error('Failed to fetch cloud file:', res.status, errData);
        alert(`Failed to open cloud file: ${errData.error || res.statusText}`);
        return;
      }
      const data = await res.json();
      const content = data.file?.content ?? data.content ?? '';
      const cloudNode: FileNode = {
        id: existingId,
        name: fileName,
        type: 'file',
        content,
      };
      setOpenFiles(prev => {
        if (prev.find(f => f.id === cloudNode.id)) return prev;
        return [...prev, cloudNode];
      });
      setActiveFileId(cloudNode.id);
    } catch (err) {
      console.error('Failed to open cloud file:', err);
      alert('Network error opening cloud file. Check your connection.');
    }
  };

  useEffect(() => {
    const dirtyFiles = openFiles.filter(f => f.isDirty);
    if (dirtyFiles.length === 0) return;

    const timer = setTimeout(async () => {
      for (const file of dirtyFiles) {
         const success = await saveFile(file);
         if (success) {
           setOpenFiles(prev => prev.map(f => f.id === file.id ? { ...f, isDirty: false } : f));
         }
      }
    }, 1500); 

    return () => clearTimeout(timer);
  }, [openFiles]);

  useEffect(() => {
    if (!activeFileId) {
      setOutline([]);
      return;
    }
    const content = openFiles.find(f => f.id === activeFileId)?.content || '';
    const lines = content.split('\n');
    const items: OutlineItem[] = [];
    const slugger = new GithubSlugger();
    
    const regex = /^(#{1,6})\s+(.+)$/;
    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(regex);
      if (match) {
        let title = match[2].trim();
        const plainTitle = title.replace(/[`*_[\]]/g, '').trim();
        const id = slugger.slug(plainTitle);
        items.push({ level: match[1].length, title: title.replace(/[*_`]/g, ''), id, line: i + 1 });
      }
    }
    setOutline(items);
  }, [activeFileId, openFiles]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActiveSidebar('search');
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setClosedTabs(prev => {
          if (prev.length === 0) return prev;
          const newClosed = [...prev];
          const lastClosed = newClosed.pop();
          if (lastClosed) {
            setOpenFiles(currentOpen => {
               if (currentOpen.find(f => f.id === lastClosed.id)) return currentOpen;
               return [...currentOpen, lastClosed];
            });
            setActiveFileId(lastClosed.id);
          }
          return newClosed;
        });
      } else if (e.ctrlKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setActiveSidebar('search');
      } else if (e.ctrlKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (activeFileIdRef.current) {
          closeTab(activeFileIdRef.current);
        }
      } else if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const currentId = activeFileIdRef.current;
        if (!currentId) return;
        const fileNode = openFilesRef.current.find(f => f.id === currentId);
        if (fileNode) {
           const success = await saveFile(fileNode);
           if (success) {
             setOpenFiles(prev => prev.map(f => f.id === fileNode.id ? { ...f, isDirty: false } : f));
           } else {
             alert('Save failed.');
           }
        }
      }
    };
    
    const handleWindowClick = () => {
      setContextMenu(null);
      setShowExportMenu(false);
      setShowWorkspaceMenu(false);
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleWindowClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleWindowClick);
    };
  }, []);

  useEffect(() => {
    // Load workspaces — filter out empty ones leftover from old defaults
    get('md-viewer-workspaces').then((data: any) => {
      if (data && Array.isArray(data)) {
        const validWorkspaces = data.filter((ws: any) => ws.folderHandles && ws.folderHandles.length > 0);
        setWorkspaces(validWorkspaces);
        if (validWorkspaces.length !== data.length) {
          set('md-viewer-workspaces', validWorkspaces); // Clean up stale entries
        }
      }
      // No default workspaces — start clean
    });
    
    get('md-viewer-active-ws').then((wsId: any) => {
      if (wsId) {
        setActiveWorkspaceId(wsId);
      }
    });
  }, []);

  useEffect(() => {
    if (activeWorkspaceId) {
      set('md-viewer-active-ws', activeWorkspaceId);
      const ws = workspaces.find(w => w.id === activeWorkspaceId);
      if (ws && ws.folderHandles.length > 0) {
        refreshWorkspaceFolders(ws.folderHandles);
      } else {
        setFiles([]);
      }
    }
  }, [activeWorkspaceId, workspaces]);

  const saveWorkspaces = async (newWorkspaces: WorkspaceData[]) => {
    setWorkspaces(newWorkspaces);
    await set('md-viewer-workspaces', newWorkspaces);
  };

  const handleCreateWorkspace = async () => {
    const name = prompt("Enter new workspace name:");
    if (!name) return;
    const newWs: WorkspaceData = {
      id: `ws-${Date.now()}`,
      name,
      folderHandles: [],
      favoriteFiles: [],
      settings: {}
    };
    const newWorkspaces = [...workspaces, newWs];
    await saveWorkspaces(newWorkspaces);
    setActiveWorkspaceId(newWs.id);
  };



  const handleExport = async (format: string) => {
    setShowExportMenu(false);
    const activeFile = openFilesRef.current.find(f => f.id === activeFileId);
    if (!activeFile) return;

    const content = activeFile.content || '';
    const baseName = activeFile.name.replace(/\.[^/.]+$/, "");

    if (format === 'txt') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      saveAs(blob, `${baseName}.txt`);
      return;
    } 
    
    if (format === 'json') {
      try {
        const ast = unified().use(remarkParse).parse(content);
        const blob = new Blob([JSON.stringify(ast, null, 2)], { type: 'application/json' });
        saveAs(blob, `${baseName}.json`);
      } catch (err) {
        alert('Failed to generate AST');
      }
      return;
    }

    const previewContainer = document.querySelector('.markdown-preview') as HTMLElement;
    if (!previewContainer) {
      alert("Please open Split or Preview mode to export rendered formats.");
      return;
    }

    const htmlContent = previewContainer.innerHTML;
    let styles = '';
    try {
      styles = Array.from(document.styleSheets)
        .map(s => {
          try {
            return Array.from(s.cssRules || []).map(r => r.cssText).join('');
          } catch(e) { return ''; }
        })
        .join('\n');
    } catch(e) {}

    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${baseName}</title>
        <style>${styles}</style>
      </head>
      <body style="padding: 24px; font-family: sans-serif;">
        <div class="markdown-preview" style="background-color: var(--color-bg-primary); color: var(--color-text-primary);">
          ${htmlContent}
        </div>
      </body>
      </html>
    `;

    if (format === 'html') {
      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      saveAs(blob, `${baseName}.html`);
    } else if (format === 'pdf') {
      const opt = {
        margin:       10,
        filename:     `${baseName}.pdf`,
        image:        { type: 'jpeg' as const, quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };
      html2pdf().set(opt).from(previewContainer).save();
    } else if (format === 'docx') {
      try {
        if (htmlDocx && htmlDocx.asBlob) {
          const blob = await htmlDocx.asBlob(fullHtml);
          saveAs(blob as Blob, `${baseName}.docx`);
        } else {
          throw new Error("htmlDocx not loaded");
        }
      } catch (err) {
        const docxHtml = `
          <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
          <head><meta charset='utf-8'><title>${baseName}</title><style>${styles}</style></head>
          <body>${htmlContent}</body>
          </html>
        `;
        const blob = new Blob(['\ufeff', docxHtml], { type: 'application/msword' });
        saveAs(blob, `${baseName}.doc`);
      }
    }
  };

  const buildFileTree = async (dirHandle: any, parentHandle?: any, parentPath: string = '', parentId: string | null = null): Promise<FileNode> => {
    const children: FileNode[] = [];
    const currentId = parentPath || dirHandle.name;

    for await (const entry of dirHandle.values()) {
      const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      if (entry.kind === 'file') {
        if (entry.name.endsWith('.md') || entry.name.endsWith('.txt')) {
           children.push({
             id: path,
             name: entry.name,
             type: 'file',
             handle: entry,
             parentHandle: dirHandle,
             parentId: currentId
           });
        }
      } else if (entry.kind === 'directory') {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const childNode = await buildFileTree(entry, dirHandle, path, currentId);
        children.push(childNode);
      }
    }
    
    return {
      id: currentId,
      name: dirHandle.name,
      type: 'folder',
      parentId,
      children: children.sort((a, b) => {
         if (a.type === b.type) return a.name.localeCompare(b.name);
         return a.type === 'folder' ? -1 : 1;
      }),
      handle: dirHandle,
      parentHandle: parentHandle,
    };
  };

  const refreshWorkspaceFolders = async (handles: any[]) => {
    try {
      const rootNodes = await Promise.all(handles.map(h => buildFileTree(h)));
      setFiles(rootNodes); // Top level files are now the folders themselves
    } catch (err) {
      console.error('Error refreshing folders:', err);
    }
  };

  const refreshFolder = async (handle = rootDirHandleRef.current) => {
    if (activeWorkspaceId) {
      const ws = workspaces.find(w => w.id === activeWorkspaceId);
      if (ws) refreshWorkspaceFolders(ws.folderHandles);
      return;
    }
    if (!handle) return;
    try {
      const rootNode = await buildFileTree(handle);
      setFiles(rootNode.children || []);
    } catch (err) {
      console.error('Error refreshing folder:', err);
    }
  };

  const handleOpenFolder = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ mode: 'readwrite' });
      
      if (activeWorkspaceId) {
        // Add to active workspace
        const newWorkspaces = workspaces.map(ws => {
          if (ws.id === activeWorkspaceId) {
            // check if not already added
            if (!ws.folderHandles.find(h => h.name === dirHandle.name)) {
               return { ...ws, folderHandles: [...ws.folderHandles, dirHandle] };
            }
          }
          return ws;
        });
        await saveWorkspaces(newWorkspaces);
      } else {
        // Fallback for no workspace
        setRootDirHandle(dirHandle);
        setRootDirName(dirHandle.name);
        setSelectedNodeId(dirHandle.name);
        const rootNode = await buildFileTree(dirHandle);
        setFiles(rootNode.children || []);
      }
    } catch (err) {
      console.error(err);
    }
  };


  const findNodeById = (nodes: FileNode[], id: string): FileNode | null => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findNodeById(n.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const getTargetFolder = () => {
    let handle = rootDirHandleRef.current;
    let folderId = rootDirHandleRef.current?.name; // default to root

    if (!handle && activeWorkspaceId) {
      const ws = workspaces.find(w => w.id === activeWorkspaceId);
      if (ws && ws.folderHandles.length > 0) {
        handle = ws.folderHandles[0];
        folderId = ws.folderHandles[0].name;
      }
    }

    if (selectedNodeId && selectedNodeId !== folderId) {
      const node = findNodeById(files, selectedNodeId);
      if (node) {
        if (node.type === 'folder') {
          handle = node.handle;
          folderId = node.id;
        } else if (node.parentHandle) {
          handle = node.parentHandle;
          folderId = node.parentId || folderId;
        }
      }
    }
    return { folderId, handle };
  };

  const handleCreateFile = async () => {
    const target = getTargetFolder();
    
    if (!target.handle) {
      // No folder loaded — create a virtual untitled file directly in editor
      const untitledId = `untitled-${Date.now()}`;
      const untitledFile: FileNode = {
        id: untitledId,
        name: `Untitled.md`,
        type: 'file',
        content: '',
        isDirty: true,
      };
      setOpenFiles(prev => [...prev, untitledFile]);
      setActiveFileId(untitledId);
      return;
    }
    setInlineInput({ type: 'new-file', targetFolderId: target.folderId, targetHandle: target.handle });
  };

  const handleCreateFolder = async () => {
    const target = getTargetFolder();
    
    if (!target.handle) {
      alert('Please import a folder first before creating subfolders.');
      return;
    }
    setInlineInput({ type: 'new-folder', targetFolderId: target.folderId, targetHandle: target.handle });
  };

  // Upload all open files in the workspace to B2 cloud
  const handleUploadToCloud = async () => {
    const token = authToken || localStorage.getItem('token');
    if (!token) {
      alert('Please log in to upload files to cloud.');
      return;
    }

    // Collect all markdown files from the explorer tree
    const collectFiles = async (nodes: FileNode[]): Promise<{name: string, content: string}[]> => {
      const result: {name: string, content: string}[] = [];
      for (const node of nodes) {
        if (node.type === 'file' && node.handle) {
          try {
            const file = await node.handle.getFile();
            const content = await file.text();
            result.push({ name: node.name, content });
          } catch (e) {
            console.error('Failed to read', node.name);
          }
        } else if (node.children) {
          const childFiles = await collectFiles(node.children);
          result.push(...childFiles);
        }
      }
      return result;
    };

    // Also include open files that have no handle (untitled / virtual)
    const allFiles = await collectFiles(files);
    for (const of_ of openFiles) {
      if (!of_.handle && of_.content !== undefined) {
        allFiles.push({ name: of_.name, content: of_.content });
      }
    }

    if (allFiles.length === 0) {
      alert('No files to upload.');
      return;
    }

    let successCount = 0;
    for (const f of allFiles) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/files/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ fileName: f.name, content: f.content }),
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error('Upload failed for', f.name, err);
      }
    }
    
    alert(`☁️ Uploaded ${successCount} / ${allFiles.length} files to cloud.`);
    // Refresh cloud files list
    fetchUserFiles(token);
  };

  const handleRename = (node: FileNode) => {
    setContextMenu(null);
    setSelectedNodeId(node.id);
    setInlineInput({ type: 'rename', node });
  };

  const handleConfirmInlineInput = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setInlineInput(null);
      return;
    }

    if (inlineInput?.type === 'new-file' || inlineInput?.type === 'new-folder') {
      const { targetHandle } = inlineInput as any;
      try {
        if (inlineInput.type === 'new-file') {
          await targetHandle.getFileHandle(trimmed, { create: true });
        } else {
          await targetHandle.getDirectoryHandle(trimmed, { create: true });
        }
        await refreshFolder();
      } catch (err: any) {
        alert(`Create failed: ${err.message}`);
      }
    } else if (inlineInput?.type === 'rename') {
      const node = inlineInput.node;
      if (trimmed === node.name) {
        setInlineInput(null);
        return;
      }
      if (node.type === 'file' && node.parentHandle && node.handle) {
        try {
          const newFileHandle = await node.parentHandle.getFileHandle(trimmed, { create: true });
          const file = await node.handle.getFile();
          const content = await file.text();
          const writable = await newFileHandle.createWritable();
          await writable.write(content);
          await writable.close();
          await node.parentHandle.removeEntry(node.name);
          
          setOpenFiles(prev => prev.map(f => {
            if (f.id === node.id) {
              return { ...f, id: trimmed, name: trimmed, handle: newFileHandle };
            }
            return f;
          }));
          if (activeFileId === node.id) setActiveFileId(trimmed);

          await refreshFolder();
        } catch (err: any) {
          alert('Rename failed: ' + err.message);
        }
      } else {
        alert('Rename folder currently not supported or invalid node.');
      }
    }
    setInlineInput(null);
  };

  const handleDelete = async (node: FileNode) => {
    setContextMenu(null);
    if (confirm(`Are you sure you want to delete ${node.name}?`)) {
      if (node.parentHandle) {
        try {
          await node.parentHandle.removeEntry(node.name, { recursive: node.type === 'folder' });
          closeTab(node.id);
          if (selectedNodeId === node.id) setSelectedNodeId(rootDirHandleRef.current?.name || null);
          await refreshFolder();
        } catch (err: any) {
          console.error(err);
          alert('Delete failed: ' + err.message);
        }
      } else {
        alert('Cannot delete this node');
      }
    }
  };

  const handleDuplicate = async (node: FileNode) => {
    setContextMenu(null);
    if (node.type !== 'file' || !node.parentHandle || !node.handle) {
      alert('Only files within an opened folder can be duplicated');
      return;
    }
    
    const ext = node.name.includes('.') ? node.name.substring(node.name.lastIndexOf('.')) : '';
    const base = node.name.includes('.') ? node.name.substring(0, node.name.lastIndexOf('.')) : node.name;
    const newName = `${base} (copy)${ext}`;
    
    try {
      const newFileHandle = await node.parentHandle.getFileHandle(newName, { create: true });
      const file = await node.handle.getFile();
      const content = await file.text();
      const writable = await newFileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      await refreshFolder();
    } catch (err: any) {
      console.error(err);
      alert('Duplicate failed: ' + err.message);
    }
  };

  const togglePin = (node: FileNode) => {
    setContextMenu(null);
    setOpenFiles(prev => prev.map(f => f.id === node.id ? { ...f, isPinned: !f.isPinned } : f));
  };

  const toggleFavoriteFile = async (node: FileNode) => {
    setContextMenu(null);
    if (node.type !== 'file' || !node.handle || !activeWorkspaceId) return;

    const newWorkspaces = workspaces.map(ws => {
      if (ws.id === activeWorkspaceId) {
        const isFav = ws.favoriteFiles.some(f => f.id === node.id);
        const newFavs = isFav 
          ? ws.favoriteFiles.filter(f => f.id !== node.id)
          : [...ws.favoriteFiles, { id: node.id, name: node.name, handle: node.handle, parentHandle: node.parentHandle }];
        return { ...ws, favoriteFiles: newFavs };
      }
      return ws;
    });
    await saveWorkspaces(newWorkspaces);
  };

  const performSearch = useCallback(async () => {
    if (!searchQuery) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const results: any[] = [];
    
    let regex: RegExp;
    try {
      let pattern = searchQuery;
      if (!searchRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (searchWholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      regex = new RegExp(pattern, searchCaseSensitive ? 'g' : 'gi');
    } catch (e) {
      setIsSearching(false);
      return; 
    }

    const searchInNode = async (node: FileNode) => {
      if (node.type === 'file') {
        const matchName = regex.test(node.name);
        regex.lastIndex = 0;
        
        let content = node.content;
        const openFile = openFilesRef.current.find(f => f.id === node.id);
        if (openFile && openFile.content !== undefined) {
          content = openFile.content;
        } else if (content === undefined && node.handle) {
          try {
            const file = await node.handle.getFile();
            content = await file.text();
          } catch(e) {
            content = '';
          }
        }
        
        const snippets: { line: number, text: string }[] = [];
        if (content) {
          const lines = content.split('\n');
          lines.forEach((line, index) => {
            regex.lastIndex = 0;
            if (regex.test(line)) {
              snippets.push({ line: index + 1, text: line.trim() });
            }
          });
        }
        
        if (matchName || snippets.length > 0) {
          results.push({ file: node, matchName, snippets, content });
        }
      } else if (node.children) {
        for (const child of node.children) {
          await searchInNode(child);
        }
      }
    };
    
    for (const file of files) {
      await searchInNode(file);
    }
    
    setSearchResults(results);
    setIsSearching(false);
  }, [searchQuery, searchRegex, searchCaseSensitive, searchWholeWord, files]);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch();
    }, 400); 
    return () => clearTimeout(timer);
  }, [performSearch]);

  const handleReplaceAll = async () => {
    if (!searchQuery || searchResults.length === 0) return;
    
    let regex: RegExp;
    try {
      let pattern = searchQuery;
      if (!searchRegex) {
        pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (searchWholeWord) {
        pattern = `\\b${pattern}\\b`;
      }
      regex = new RegExp(pattern, searchCaseSensitive ? 'g' : 'gi');
    } catch (e) {
      return;
    }
    
    if (!confirm(`Replace all occurrences in ${searchResults.length} file(s)?`)) return;
    
    for (const result of searchResults) {
      if (result.content && result.file.handle) {
         const newContent = result.content.replace(regex, replaceQuery);
         try {
           const writable = await result.file.handle.createWritable();
           await writable.write(newContent);
           await writable.close();
           
           setOpenFiles(prev => prev.map(f => f.id === result.file.id ? { ...f, content: newContent, isDirty: false } : f));
         } catch (e) {
           console.error('Failed to replace in', result.file.name);
         }
      }
    }
    
    performSearch();
  };

  const handleFileClick = async (node: FileNode) => {
    setSelectedNodeId(node.id);
    if (node.type === 'file') {
      let content = node.content;
      if (node.handle && content === undefined) {
        try {
          const file = await node.handle.getFile();
          content = await file.text();
        } catch(e) {
          console.error('Error reading file:', e);
          content = 'Error reading file content.';
        }
      }
      
      const fullNode = { ...node, content };
      
      const existingFile = openFilesRef.current.find(f => f.id === node.id);
      if (!existingFile) {
        setOpenFiles(prev => [...prev, fullNode]);
      } else if (existingFile.content === undefined && content !== undefined) {
         setOpenFiles(prev => prev.map(f => f.id === node.id ? { ...f, content } : f));
      }
      
      setActiveFileId(node.id);
      
      setRecentFiles(prev => {
        const filtered = prev.filter(f => f.id !== node.id);
        return [fullNode, ...filtered].slice(0, 10);
      });
    }
  };

  const closeTab = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const tabToClose = openFilesRef.current.find(f => f.id === id);
    if (tabToClose) {
      setClosedTabs(prev => [...prev, tabToClose]);
    }
    const newOpenFiles = openFilesRef.current.filter(f => f.id !== id);
    setOpenFiles(newOpenFiles);
    if (activeFileIdRef.current === id) {
      setActiveFileId(newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1].id : null);
    }
  };

  const handleEditorMount = (editor: any) => {
    editorRef.current = editor;
    editor.onDidChangeCursorPosition((e: any) => {
      setCursorPos({ line: e.position.lineNumber, column: e.position.column });
    });
    
    // Add AI actions to context menu
    const aiActions = [
      { id: 'ai-explain', label: 'Ask AI: Explain', action: 'explain' },
      { id: 'ai-improve', label: 'Ask AI: Improve Writing', action: 'improve' },
      { id: 'ai-grammar', label: 'Ask AI: Fix Grammar', action: 'grammar' },
      { id: 'ai-translate', label: 'Ask AI: Translate', action: 'translate' }
    ];

    aiActions.forEach((item, index) => {
      editor.addAction({
        id: item.id,
        label: item.label,
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5 + (index * 0.1),
        run: async (ed: any) => {
          const selection = ed.getSelection();
          const text = ed.getModel().getValueInRange(selection);
          if (!text) {
             alert('Please select some text first.');
             return;
          }
          
          setActiveSidebar('ai');
          
          // Actually we would like to pass this to the ChatPanel. 
          // For now, we can show an alert or a popup if we want to replace inline, 
          // or we can simulate doing it via the AI service and replacing the text.
          try {
            const oldText = text;
            const replacement = await askAI(item.action as any, oldText);
            
            // For summarize/explain, maybe we don't replace text, just show it.
            if (item.action === 'explain') {
               alert(replacement);
            } else {
               ed.executeEdits('ai-service', [{
                  range: selection,
                  text: replacement,
                  forceMoveMarkers: true
               }]);
            }
          } catch (e) {
            console.error(e);
          }
        }
      });
    });
  };

  const handleContentChange = (value: string | undefined) => {
    if (value === undefined || activeFileId === null) return;
    
    setOpenFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, content: value, isDirty: true } : f));

    // Broadcast the change to other users via Go Server
    if (!isUpdatingFromWs.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update-content',
        fileId: activeFileId,
        content: value
      }));
    }
  };

  const handleEditorDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
    
    const file = e.dataTransfer.files[0];
    if (!file.type.startsWith('image/')) return;
    
    try {
      // 1. Get presigned URL from backend
      const token = authToken || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fileName: file.name, fileType: file.type })
      });
      const data = await response.json();
      if (!data.uploadUrl) throw new Error(data.error || 'Failed to get upload URL');
      
      // 2. Upload file to Backblaze using the presigned URL
      const uploadRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });
      if (!uploadRes.ok) throw new Error('Upload to S3/B2 failed');
      
      // 3. Insert markdown image tag at current cursor
      if (editorRef.current) {
        const position = editorRef.current.getPosition();
        if (position) {
          editorRef.current.executeEdits('image-upload', [{
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            text: `![${file.name}](${data.fileUrl})\n`,
            forceMoveMarkers: true
          }]);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image. Make sure backend is running and Backblaze credentials are set in .env.');
    }
  };

  const handleEditorDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleEditorPaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (!e.clipboardData.files || e.clipboardData.files.length === 0) return;
    
    const file = e.clipboardData.files[0];
    if (!file.type.startsWith('image/')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // 1. Get presigned URL from backend
      const token = authToken || localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/upload-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) },
        body: JSON.stringify({ fileName: file.name, fileType: file.type })
      });
      const data = await response.json();
      if (!data.uploadUrl) throw new Error(data.error || 'Failed to get upload URL');
      
      // 2. Upload file to Backblaze using the presigned URL
      const uploadRes = await fetch(data.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });
      if (!uploadRes.ok) throw new Error('Upload to S3/B2 failed');
      
      // 3. Insert markdown image tag at current cursor
      if (editorRef.current) {
        const position = editorRef.current.getPosition();
        if (position) {
          editorRef.current.executeEdits('image-upload', [{
            range: {
              startLineNumber: position.lineNumber,
              startColumn: position.column,
              endLineNumber: position.lineNumber,
              endColumn: position.column
            },
            text: `![${file.name}](${data.fileUrl})\n`,
            forceMoveMarkers: true
          }]);
        }
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload image. Make sure backend is running and Backblaze credentials are set in .env.');
    }
  };

  const startResizing = useCallback(() => {
    isResizing.current = true;
    const handleMouseMove = (mouseMoveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = mouseMoveEvent.clientX - 50;
      if (newWidth > 150 && newWidth < 800) {
        setExplorerWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  }, []);

  const handlePreviewScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const headings = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    if (headings.length === 0) return;
    
    const containerTop = container.getBoundingClientRect().top;
    
    let currentActive = headings[0].id;
    for (const h of headings) {
      const rect = h.getBoundingClientRect();
      if (rect.top - containerTop <= 150) {
        currentActive = h.id;
      } else {
        break;
      }
    }
    if (currentActive !== activeHeadingId) {
      setActiveHeadingId(currentActive);
    }
  };

  const toggleOutlineCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedOutline(prev => {
       const next = new Set(prev);
       if (next.has(id)) next.delete(id);
       else next.add(id);
       return next;
    });
  };

  const hasOutlineChildren = (index: number) => {
    if (index === outline.length - 1) return false;
    return outline[index + 1].level > outline[index].level;
  };

  const handleOutlineClick = (id: string, line: number) => {
    if (editorRef.current) {
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
      editorRef.current.revealLineInCenter(line);
      editorRef.current.focus();
    }
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  let currentCollapsedLevel: number | null = null;
  const visibleOutline = outline.filter(item => {
      if (currentCollapsedLevel !== null) {
         if (item.level <= currentCollapsedLevel) {
            currentCollapsedLevel = null;
         } else {
            return false;
         }
      }
      if (collapsedOutline.has(item.id)) {
         currentCollapsedLevel = item.level;
      }
      return true;
  });

  if (!isLoggedIn) {
    return <Auth onLogin={(userData) => {
      setIsLoggedIn(true);
      setAuthToken(userData.token);
      fetchUserFiles(userData.token);
    }} />;
  }

  return (
    <div className="ide-container">
      <div className="title-bar">
        Markdown Viewer - Workspace
      </div>

      <div className="main-content">
        <div className="activity-bar">
          <div className={`activity-icon ${activeSidebar === 'explorer' ? 'active' : ''}`} onClick={() => setActiveSidebar('explorer')} title="Explorer">
            <Files size={24} strokeWidth={1.5} />
          </div>
          <div className={`activity-icon ${activeSidebar === 'search' ? 'active' : ''}`} onClick={() => setActiveSidebar('search')} title="Search">
            <Search size={24} strokeWidth={1.5} />
          </div>
          <div className={`activity-icon ${activeSidebar === 'outline' ? 'active' : ''}`} onClick={() => setActiveSidebar('outline')} title="Outline">
            <AlignLeft size={24} strokeWidth={1.5} />
          </div>
          <div className={`activity-icon ${activeSidebar === 'ai' ? 'active' : ''}`} onClick={() => setActiveSidebar('ai')} title="Ask AI">
            <Sparkles size={24} strokeWidth={1.5} />
          </div>
          <div className="activity-icon" title="Source Control">
            <GitBranch size={24} strokeWidth={1.5} />
          </div>
          <div className="activity-icon" title="Run">
            <Play size={24} strokeWidth={1.5} />
          </div>
          <div style={{ flex: 1 }} />
          <div className="activity-icon" style={{ marginBottom: '16px' }} title="Settings">
            <Settings size={24} strokeWidth={1.5} />
          </div>
        </div>

        <div className="explorer" style={{ width: `${explorerWidth}px`, overflowY: 'auto' }}>
          {activeSidebar === 'explorer' ? (
            <>
              <div className="explorer-header" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ position: 'relative' }}>
                    <span 
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                      onClick={(e) => { e.stopPropagation(); setShowWorkspaceMenu(!showWorkspaceMenu); }}
                    >
                      {activeWorkspaceId ? workspaces.find(w => w.id === activeWorkspaceId)?.name : 'Explorer'}
                      <ChevronRight size={14} style={{ transform: showWorkspaceMenu ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </span>
                    {showWorkspaceMenu && (
                      <div className="context-menu" style={{ top: '100%', left: 0, marginTop: '4px', position: 'absolute', zIndex: 1000, width: '180px' }}>
                        <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Recent Workspaces</div>
                        {workspaces.map(ws => (
                          <div 
                            key={ws.id}
                            className="context-menu-item" 
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                            onClick={() => { setActiveWorkspaceId(ws.id); setShowWorkspaceMenu(false); }}
                          >
                            <span>{ws.name}</span>
                            {activeWorkspaceId === ws.id && <CheckCircle2 size={12} color="var(--color-accent)" />}
                          </div>
                        ))}
                        <div style={{ borderTop: '1px solid var(--color-border)', margin: '4px 0' }}></div>
                        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); setShowWorkspaceSettings(true); setShowWorkspaceMenu(false); }}>
                          <Settings size={14} style={{ display: 'inline', marginRight: '8px' }} /> Workspace Settings
                        </div>
                        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleCreateWorkspace(); setShowWorkspaceMenu(false); }}>
                          <FilePlus size={14} style={{ display: 'inline', marginRight: '8px' }} /> New Workspace
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    <button title="Import Folder" onClick={handleOpenFolder} className="explorer-action-btn">
                      <FolderOpen size={14} />
                    </button>
                    <button title="New File" onClick={handleCreateFile} className="explorer-action-btn">
                      <FilePlus size={14} />
                    </button>
                    <button title="New Folder" onClick={handleCreateFolder} className="explorer-action-btn">
                      <FolderPlus size={14} />
                    </button>
                    <button title="Upload All to Cloud" onClick={handleUploadToCloud} className="explorer-action-btn" style={{ color: '#58a6ff' }}>
                      <CloudUpload size={14} />
                    </button>
                    <button title="Refresh" onClick={() => refreshFolder()} className="explorer-action-btn">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="explorer-content">
                {activeWorkspaceId && workspaces.find(w => w.id === activeWorkspaceId)?.favoriteFiles?.length ? (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ padding: '4px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                      Favorites
                    </div>
                    {workspaces.find(w => w.id === activeWorkspaceId)?.favoriteFiles.map(fav => (
                       <div 
                         key={fav.id}
                         className={`explorer-item ${selectedNodeId === fav.id ? 'selected' : ''}`}
                         style={{ paddingLeft: '24px' }}
                         onClick={() => handleFileClick({ id: fav.id, name: fav.name, type: 'file', handle: fav.handle, parentHandle: fav.parentHandle })}
                       >
                         <FileCode size={16} color="#58a6ff" />
                         <span>{fav.name}</span>
                       </div>
                    ))}
                  </div>
                ) : null}
                
                {(!activeWorkspaceId) && (
                  <div 
                    className={`explorer-item ${selectedNodeId === rootDirHandleRef.current?.name ? 'selected' : ''}`} 
                    style={{ fontWeight: 600 }}
                    onClick={() => setSelectedNodeId(rootDirHandleRef.current?.name || null)}
                  >
                    <ChevronRight size={16} style={{ transform: 'rotate(90deg)' }} />
                    <span>{rootDirName}</span>
                  </div>
                )}
                
                {inlineInput && (inlineInput.type === 'new-file' || inlineInput.type === 'new-folder') && (inlineInput as any).targetFolderId === rootDirHandleRef.current?.name && (
                   <InlineInput
                     defaultValue=""
                     onSubmit={handleConfirmInlineInput}
                     onCancel={() => setInlineInput(null)}
                     paddingLeft={24}
                     icon={inlineInput.type === 'new-folder' ? <ChevronRight size={16} /> : <FileCode size={16} color="#58a6ff" />}
                   />
                )}
                {files.map(file => (
                  <FileItem 
                    key={file.id} 
                    node={file} 
                    depth={activeWorkspaceId ? 0 : 1} 
                    onFileClick={handleFileClick} 
                    onContextMenu={(e, node) => setContextMenu({ x: e.pageX, y: e.pageY, file: node, type: 'explorer' })}
                    inlineInput={inlineInput}
                    onConfirmInput={handleConfirmInlineInput}
                    onCancelInput={() => setInlineInput(null)}
                    selectedNodeId={selectedNodeId}
                  />
                ))}
              </div>
            </>
          ) : activeSidebar === 'search' ? (
            <>
              <div className="explorer-header">Search</div>
              <div style={{ padding: '16px' }}>
                <div className="search-input-wrapper">
                  <input 
                    type="text" 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                    autoFocus
                  />
                  <div className="search-options">
                    <button className={`search-opt-btn ${searchCaseSensitive ? 'active' : ''}`} onClick={() => setSearchCaseSensitive(!searchCaseSensitive)} title="Match Case">Aa</button>
                    <button className={`search-opt-btn ${searchWholeWord ? 'active' : ''}`} onClick={() => setSearchWholeWord(!searchWholeWord)} title="Match Whole Word">ab</button>
                    <button className={`search-opt-btn ${searchRegex ? 'active' : ''}`} onClick={() => setSearchRegex(!searchRegex)} title="Use Regular Expression">.*</button>
                  </div>
                </div>
                <div className="search-input-wrapper" style={{ marginTop: '8px' }}>
                  <input 
                    type="text" 
                    placeholder="Replace..." 
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    className="search-input"
                  />
                  <button className="search-opt-btn" onClick={handleReplaceAll} title="Replace All" style={{ padding: '0 8px' }}>
                    <RefreshCw size={12} />
                  </button>
                </div>
                
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {isSearching ? (
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>Searching...</div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
                        {searchResults.reduce((acc, r) => acc + r.snippets.length, 0)} results in {searchResults.length} files
                      </div>
                      {searchResults.map((result, i) => (
                        <div key={i} style={{ fontSize: '13px' }}>
                          <div 
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: 'var(--color-accent)' }}
                            onClick={() => handleFileClick(result.file)}
                          >
                            <FileCode size={14} />
                            <span>{result.file.name}</span>
                          </div>
                          <div style={{ marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {result.snippets.slice(0, 5).map((snippet, j) => (
                              <div key={j} style={{ paddingLeft: '20px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                <span style={{ opacity: 0.5, marginRight: '6px' }}>{snippet.line}</span>
                                {snippet.text}
                              </div>
                            ))}
                            {result.snippets.length > 5 && (
                              <div style={{ paddingLeft: '20px', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                                +{result.snippets.length - 5} more matches
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    searchQuery && <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>No results found.</div>
                  )}
                </div>
              </div>
            </>
          ) : activeSidebar === 'outline' ? (
            <>
              <div className="explorer-header">Outline</div>
              <div className="explorer-content">
                {outline.length === 0 ? (
                  <div style={{ padding: '16px', color: 'var(--color-text-secondary)', fontSize: '13px', textAlign: 'center' }}>No headings found</div>
                ) : (
                  visibleOutline.map((item) => {
                    const originalIndex = outline.findIndex(o => o.id === item.id);
                    const childrenExist = hasOutlineChildren(originalIndex);
                    const isCollapsed = collapsedOutline.has(item.id);
                    
                    return (
                      <div 
                        key={item.id}
                        className={`explorer-item ${activeHeadingId === item.id ? 'active-outline' : ''}`}
                        style={{ paddingLeft: `${12 + (item.level - 1) * 12}px` }}
                        onClick={() => handleOutlineClick(item.id, item.line)}
                      >
                        {childrenExist ? (
                          <ChevronRight 
                            size={14} 
                            onClick={(e) => toggleOutlineCollapse(item.id, e)} 
                            style={{ transform: isCollapsed ? 'none' : 'rotate(90deg)', transition: 'transform 0.2s', marginRight: 4 }} 
                          />
                        ) : (
                          <span style={{ width: 14, marginRight: 4, display: 'inline-block' }}></span>
                        )}
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : activeSidebar === 'ai' ? (
            <ChatPanel 
              onClose={() => setActiveSidebar('explorer')} 
              documentContent={openFiles.find(f => f.id === activeFileId)?.content || ''}
            />
          ) : null}
        </div>

        <div className="resize-handle" onMouseDown={startResizing} />

        <div className="editor-area">
          {openFiles.length > 0 && (
            <div className="tabs-container">
              {openFiles.map((file, index) => (
                <div 
                  key={file.id} 
                  className={`tab ${activeFileId === file.id ? 'active' : ''}`}
                  onClick={() => setActiveFileId(file.id)}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.pageX, y: e.pageY, file, type: 'tab' }); }}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData('tabIndex', index.toString()); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceIndex = parseInt(e.dataTransfer.getData('tabIndex'));
                    if (sourceIndex === index || isNaN(sourceIndex)) return;
                    const newOpenFiles = [...openFiles];
                    const [movedTab] = newOpenFiles.splice(sourceIndex, 1);
                    newOpenFiles.splice(index, 0, movedTab);
                    setOpenFiles(newOpenFiles);
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {!file.isPinned && <FileCode size={14} color={activeFileId === file.id ? "#58a6ff" : "#8b949e"} />}
                    <span style={{ fontWeight: file.isDirty ? '600' : 'normal', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {file.name}{file.isDirty ? ' ●' : ''}{file.isPinned ? ' 📌' : ''}
                    </span>
                  </div>
                  <X 
                    size={14} 
                    style={{ marginLeft: '12px', opacity: 0.5, cursor: 'pointer' }} 
                    onClick={(e) => closeTab(file.id, e)}
                  />
                </div>
              ))}
            </div>
          )}
          
          {activeFileId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '8px 16px', display: 'flex', gap: '8px', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-secondary)', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  <span>{rootDirName}</span>
                  <ChevronRight size={14} />
                  <FileCode size={14} color="var(--color-accent)" />
                  <span style={{ color: 'var(--color-text-primary)' }}>{openFiles.find(f => f.id === activeFileId)?.name}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  
                  {/* Live Share Controls */}
                  {liveShareMode === 'none' && (
                    <>
                      <button onClick={hostSession} className="view-btn" style={{ color: '#2ea043' }}><Bot size={14}/> Share</button>
                      <button onClick={joinSession} className="view-btn"><Layout size={14}/> Join</button>
                    </>
                  )}
                  {liveShareMode === 'host' && (
                    <div style={{ display: 'flex', alignItems: 'center', color: '#2ea043', fontSize: '13px', background: '#2ea04322', padding: '2px 8px', borderRadius: '4px' }}>
                      Hosting: {roomId}
                    </div>
                  )}
                  {liveShareMode === 'guest' && (
                    <div style={{ display: 'flex', alignItems: 'center', color: '#58a6ff', fontSize: '13px', background: '#58a6ff22', padding: '2px 8px', borderRadius: '4px' }}>
                      Guest in {roomId}
                    </div>
                  )}

                  <button onClick={() => setViewMode('markdown')} className={`view-btn ${viewMode === 'markdown' ? 'active' : ''}`}><FileEdit size={14}/> Markdown</button>
                  <button onClick={() => setViewMode('preview')} className={`view-btn ${viewMode === 'preview' ? 'active' : ''}`}><FileText size={14}/> Preview</button>
                  <button onClick={() => setViewMode('split')} className={`view-btn ${viewMode === 'split' ? 'active' : ''}`}><Layout size={14}/> Split</button>
                  <div style={{ position: 'relative' }}>
                    <button onClick={(e) => { e.stopPropagation(); setShowExportMenu(!showExportMenu); }} className="view-btn" style={{ marginLeft: '8px', color: 'var(--color-accent)' }}>
                      <Download size={14} /> Export
                    </button>
                    {showExportMenu && (
                      <div className="context-menu" style={{ top: '100%', right: 0, marginTop: '4px', position: 'absolute', zIndex: 1000 }}>
                        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleExport('pdf'); }}>PDF Document (.pdf)</div>
                        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleExport('html'); }}>HTML Page (.html)</div>
                        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleExport('docx'); }}>Word Document (.docx)</div>
                        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleExport('txt'); }}>Plain Text (.txt)</div>
                        <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleExport('json'); }}>AST JSON (.json)</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div 
                style={{ flex: 1, display: 'flex', overflow: 'hidden' }}
                onDrop={handleEditorDrop}
                onDragOver={handleEditorDragOver}
                onPasteCapture={handleEditorPaste}
              >
                <PanelGroup orientation="horizontal">
                  {viewMode !== 'preview' && (
                    <Panel defaultSize={50} minSize={20}>
                      <Editor
                        height="100%"
                        language="markdown"
                        theme={theme === 'github-light' ? 'vs' : 'vs-dark'}
                        value={openFiles.find(f => f.id === activeFileId)?.content || ''}
                        onChange={handleContentChange}
                        onMount={handleEditorMount}
                        options={{
                          wordWrap: 'on',
                          lineNumbers: 'on',
                          minimap: { enabled: false },
                          padding: { top: 16 }
                        }}
                      />
                    </Panel>
                  )}
                  {viewMode === 'split' && (
                    <PanelResizeHandle className="panel-resize-handle" />
                  )}
                  {viewMode !== 'markdown' && (
                    <Panel defaultSize={50} minSize={20}>
                      <div 
                        style={{ height: '100%', padding: '24px', color: '#c9d1d9', overflowY: 'auto', backgroundColor: 'var(--color-bg-primary)' }}
                        onScroll={handlePreviewScroll}
                      >
                        <div className="markdown-preview">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm, remarkEmoji, remarkMath]}
                            rehypePlugins={[rehypeRaw, rehypeKatex, rehypeSlug]}
                            components={{
                              blockquote: AdmonitionBlockquote,
                              code(props) {
                                const {children, className, node, ...rest} = props;
                                const match = /language-(\w+)/.exec(className || '');
                                const language = match ? match[1] : '';
                                
                                if (language === 'mermaid') {
                                  return <Mermaid chart={String(children).replace(/\n$/, '')} theme={theme} />;
                                }
                                
                                return match ? (
                                  <SyntaxHighlighter
                                    {...(rest as any)}
                                    PreTag="div"
                                    children={String(children).replace(/\n$/, '')}
                                    language={language}
                                    style={theme.includes('light') ? vs : vscDarkPlus}
                                  />
                                ) : (
                                  <code {...rest} className={className}>
                                    {children}
                                  </code>
                                );
                              }
                            }}
                          >
                            {openFiles.find(f => f.id === activeFileId)?.content || ''}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </Panel>
                  )}
                </PanelGroup>
              </div>
            </div>
          ) : (
            <div className="empty-editor">
              <Code2 size={120} className="empty-editor-icon" />
              <div className="empty-editor-text">Markdown Viewer</div>
              
              <div style={{ display: 'flex', gap: '48px', marginTop: '32px' }}>
                <div>
                  <div style={{ color: 'var(--color-text-primary)', marginBottom: '16px', fontWeight: '500' }}>Start</div>
                  <div className="empty-editor-shortcut">
                    <span>New File</span>
                    <span className="kbd" onClick={handleCreateFile} style={{ cursor: 'pointer' }}>Click Here</span>
                  </div>
                  <div className="empty-editor-shortcut">
                    <span>Import Folder</span>
                    <span className="kbd" onClick={handleOpenFolder} style={{ cursor: 'pointer' }}>Click Here</span>
                  </div>
                  <div className="empty-editor-shortcut">
                    <span>Reopen Closed Tab</span>
                    <span className="kbd">Ctrl</span>
                    <span>+</span>
                    <span className="kbd">Shift</span>
                    <span>+</span>
                    <span className="kbd">T</span>
                  </div>
                  <div className="empty-editor-shortcut">
                    <span>Search Workspace</span>
                    <span className="kbd">Ctrl</span>
                    <span>+</span>
                    <span className="kbd">Shift</span>
                    <span>+</span>
                    <span className="kbd">F</span>
                  </div>
                </div>
                
                {recentFiles.length > 0 && (
                  <div style={{ minWidth: '150px' }}>
                    <div style={{ color: 'var(--color-text-primary)', marginBottom: '16px', fontWeight: '500' }}>Recent</div>
                    {recentFiles.slice(0, 5).map(f => (
                       <div key={f.id} onClick={() => handleFileClick(f)} style={{ cursor: 'pointer', padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }} className="recent-file-item">
                         <FileCode size={14} /> {f.name}
                       </div>
                    ))}
                  </div>
                )}

                {cloudFiles.length > 0 && (
                  <div style={{ minWidth: '150px' }}>
                    <div style={{ color: 'var(--color-text-primary)', marginBottom: '16px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ☁️ Cloud Files
                    </div>
                    {cloudFiles.slice(0, 8).map(cf => (
                       <div key={cf.id} onClick={() => openCloudFile(cf.id, cf.fileName)} style={{ cursor: 'pointer', padding: '6px 0', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }} className="recent-file-item">
                         <FileCode size={14} color="#58a6ff" /> {cf.fileName}
                       </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="status-bar">
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="status-item">
            <GitBranch size={14} />
            <span>main</span>
          </div>
          <div className="status-item">
            <AlertCircle size={14} />
            <span>0</span>
          </div>
          <div className="status-item">
            <CheckCircle2 size={14} />
            <span>Prettier</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div className="status-item">
            <span>Ln {cursorPos.line}, Col {cursorPos.column}</span>
          </div>
          <div className="status-item">
            <span>UTF-8</span>
          </div>
          <div className="status-item">
            <span>Markdown</span>
          </div>
          <div className="status-item" title="Select Theme">
            <select 
              value={theme} 
              onChange={(e) => setTheme(e.target.value)}
              style={{ background: 'transparent', color: 'inherit', border: 'none', outline: 'none', cursor: 'pointer', appearance: 'none', padding: '0 4px', fontSize: 'inherit', fontWeight: 'inherit' }}
            >
              <option value="vscode-dark" style={{ color: 'black' }}>VS Code Dark+</option>
              <option value="github-dark" style={{ color: 'black' }}>GitHub Dark</option>
              <option value="github-light" style={{ color: 'black' }}>GitHub Light</option>
              <option value="dracula" style={{ color: 'black' }}>Dracula</option>
              <option value="onedark" style={{ color: 'black' }}>One Dark Pro</option>
            </select>
          </div>
        </div>
      </div>
      
      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          {contextMenu.type === 'explorer' ? (
            <>
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleRename(contextMenu.file); }}>
                <Edit2 size={14} style={{ display: 'inline', marginRight: '8px' }} /> Rename
              </div>
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleDuplicate(contextMenu.file); }}>
                <Copy size={14} style={{ display: 'inline', marginRight: '8px' }} /> Duplicate
              </div>
              {activeWorkspaceId && contextMenu.file.type === 'file' && (
                <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); toggleFavoriteFile(contextMenu.file); }}>
                  <Pin size={14} style={{ display: 'inline', marginRight: '8px' }} /> Toggle Favorite
                </div>
              )}
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); handleDelete(contextMenu.file); }} style={{ color: '#ff7b72' }}>
                <Trash2 size={14} style={{ display: 'inline', marginRight: '8px' }} /> Delete
              </div>
            </>
          ) : (
            <>
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); togglePin(contextMenu.file); }}>
                {contextMenu.file.isPinned ? <PinOff size={14} style={{ display: 'inline', marginRight: '8px' }} /> : <Pin size={14} style={{ display: 'inline', marginRight: '8px' }} />} 
                {contextMenu.file.isPinned ? 'Unpin Tab' : 'Pin Tab'}
              </div>
              <div className="context-menu-item" onClick={(e) => { e.stopPropagation(); closeTab(contextMenu.file.id); setContextMenu(null); }}>
                <X size={14} style={{ display: 'inline', marginRight: '8px' }} /> Close Tab
              </div>
            </>
          )}
        </div>
      )}
      
      {showWorkspaceSettings && activeWorkspaceId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div style={{ backgroundColor: 'var(--color-bg-primary)', padding: '24px', borderRadius: '8px', minWidth: '400px', border: '1px solid var(--color-border)' }}>
            <h2 style={{ marginTop: 0 }}>Workspace Settings</h2>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Workspace Name</label>
              <input 
                type="text" 
                defaultValue={workspaces.find(w => w.id === activeWorkspaceId)?.name}
                className="search-input"
                style={{ width: '100%' }}
                onBlur={async (e) => {
                  const newWorkspaces = workspaces.map(w => w.id === activeWorkspaceId ? { ...w, name: e.target.value } : w);
                  await saveWorkspaces(newWorkspaces);
                }}
              />
            </div>
            
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>Folders</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {workspaces.find(w => w.id === activeWorkspaceId)?.folderHandles.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
                    <span>{h.name}</span>
                    <button 
                      style={{ background: 'none', border: 'none', color: '#ff7b72', cursor: 'pointer' }}
                      onClick={async () => {
                         const newWorkspaces = workspaces.map(w => {
                           if (w.id === activeWorkspaceId) {
                             return { ...w, folderHandles: w.folderHandles.filter((_, idx) => idx !== i) };
                           }
                           return w;
                         });
                         await saveWorkspaces(newWorkspaces);
                         if (activeWorkspaceId) refreshWorkspaceFolders(newWorkspaces.find(w => w.id === activeWorkspaceId)!.folderHandles);
                      }}
                    ><Trash2 size={14}/></button>
                  </div>
                ))}
                {workspaces.find(w => w.id === activeWorkspaceId)?.folderHandles.length === 0 && (
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>No folders in this workspace.</div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button 
                style={{ padding: '8px 16px', backgroundColor: '#da3633', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                onClick={async () => {
                  if (confirm('Delete this workspace?')) {
                    const newWorkspaces = workspaces.filter(w => w.id !== activeWorkspaceId);
                    await saveWorkspaces(newWorkspaces);
                    setActiveWorkspaceId(newWorkspaces.length > 0 ? newWorkspaces[0].id : null);
                    setShowWorkspaceSettings(false);
                  }
                }}
              >
                Delete Workspace
              </button>
              <button 
                style={{ padding: '8px 16px', backgroundColor: 'var(--color-accent)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                onClick={() => setShowWorkspaceSettings(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Live Share Pending Guests Overlay */}
      {pendingGuests.length > 0 && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', backgroundColor: 'var(--color-bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 3000 }}>
          <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}><Bot size={16} color="var(--color-accent)"/> Waiting to Join</h4>
          {pendingGuests.map(guestId => (
            <div key={guestId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px' }}>Guest <b>{guestId}</b> wants to join.</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => acceptGuest(guestId)} style={{ padding: '4px 8px', background: '#2ea043', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Accept</button>
                <button onClick={() => rejectGuest(guestId)} style={{ padding: '4px 8px', background: '#da3633', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Deny</button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default App;
