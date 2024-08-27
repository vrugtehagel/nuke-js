browser.action.onClicked.addListener(async () => {
	const query = {active: true, currentWindow: true}
	const [activeTab] = await browser.tabs.query(query)
	const url = new URL(activeTab.url)
	const { origin } = url
	if(cache.has(origin)) unnuke(origin)
	else nuke(origin)
	updateIcon(origin)
})

const cache = new Map()

const createHandler = origin => event => {
	const originUrl = new URL(event.originUrl)
	if(originUrl.origin != origin) return
	return { cancel: true }
}

async function nuke(origin){
	if(cache.has(origin)) return
	const handler = createHandler(origin)
	browser.webRequest.onBeforeRequest.addListener(handler, {
		types: ['script'],
		urls: ['<all_urls>']
	}, ['blocking'])
	cache.set(origin, handler)
	const { hostname } = new URL(origin)
	await browser.browsingData.remove({
		hostnames: [hostname]
	}, {cookies: true, cache: true})
	const tabs = await browser.tabs.query({ url: `${origin}/*` })
	for(const tab of tabs) browser.tabs.reload(tab.id)
	await browser.storage.local.set({[origin]: true})
}

async function unnuke(origin){
	if(!cache.has(origin)) return
	const handler = cache.get(origin)
	browser.webRequest.onBeforeRequest.removeListener(handler)
	cache.delete(origin)
	await browser.storage.local.remove(origin)
}

browser.storage.local.get().then(data => {
	const origins = Object.keys(data)
	for(const origin of origins) nuke(origin)
})

function updateIcon(origin){
	const nuked = cache.has(origin)
	const path = nuked ? 'nuked.svg' : 'icon.svg'
	const title = nuked ? 'Nuked!' : 'Nuke it!'
	browser.action.setIcon({path})
	browser.action.setTitle({title})
}

browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
	if(!tab.active) return
	const url = new URL(tab.url)
	updateIcon(url.origin)
}, {properties: ['url', 'status']})

browser.tabs.onActivated.addListener(async ({tabId}) => {
	const tab = await browser.tabs.get(tabId)
	const url = new URL(tab.url)
	updateIcon(url.origin)
})
