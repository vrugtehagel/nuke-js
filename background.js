browser.action.onClicked.addListener(async () => {
	const query = {active: true, currentWindow: true}
	const [activeTab] = await browser.tabs.query(query)
	const {origin} = new URL(activeTab.url)
	const restore = cache.get(origin)
	if(restore) restore()
	else nuke(origin)
	updateIcon(activeTab)
})

// Map an origin to a "restore" function. If this map includes an origin, then
// it is nuked. To un-nuke, run the restore function.
const cache = new Map()

async function nuke(origin){
	if(cache.has(origin)) return
	const handler = event => {
		const name = 'Content-Security-Policy'
		const value = 'script-src \'none\';'
		event.responseHeaders.push({name, value})
		return {responseHeaders: event.responseHeaders}
	}
	browser.webRequest.onHeadersReceived.addListener(handler, {
		types: ['main_frame'],
		urls: [`${origin}/*`]
	}, ['blocking', 'responseHeaders'])
	const restore = () => {
		browser.webRequest.onHeadersReceived.removeListener(handler)
		cache.delete(origin)
		browser.storage.local.remove(origin)
	}
	cache.set(origin, restore)
	browser.storage.local.set({[origin]: true})
	const hostnames = [new URL(origin).hostname]
	const removing = {cookies: true, cache: true}
	await browser.browsingData.remove({hostnames}, removing)
	const tabs = await browser.tabs.query({url: `${origin}/*`})
	for(const tab of tabs) browser.tabs.reload(tab.id)
}

// Block scripts requested by a nuked origin.
// Technically, we don't need to do this; the scripts won't run due to the
// added CSP. But, not downloading them is still a bandwidth win.
browser.webRequest.onBeforeRequest.addListener(event => {
	const originUrl = new URL(event.originUrl)
	if(cache.has(originUrl.origin)) return {cancel: true}
}, {types: ['script'], urls: ['<all_urls>']}, ['blocking'])

// When this script loads, restore the user's previous nukes
browser.storage.local.get().then(data => {
	const origins = Object.keys(data)
	for(const origin of origins) nuke(origin)
})

// Update the icon whenever the user navigates around
function updateIcon(tab){
	if(!tab.url) return
	const {origin} = new URL(tab.url)
	const windowId = tab.windowId
	const nuked = cache.has(origin)
	const path = nuked ? 'nuked.svg' : 'icon.svg'
	const title = nuked ? 'Nuked!' : 'Nuke it!'
	browser.action.setIcon({path, windowId})
	browser.action.setTitle({title})
}

browser.tabs.onUpdated.addListener((id, changeInfo, tab) => {
	if(!tab.active) return
	updateIcon(tab)
}, {properties: ['url', 'status']})

browser.tabs.onActivated.addListener(async ({tabId}) => {
	const tab = await browser.tabs.get(tabId)
	updateIcon(tab)
})
