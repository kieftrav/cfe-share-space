import { render } from 'preact'
import { LocationProvider, Router, Route } from 'preact-iso'
import './index.css'
import { App } from './app'
import { Cfes } from './pages/Cfes'
import { News } from './pages/News'
import { Featured } from './pages/Featured'
import { Discussion } from './pages/Discussion'
import { Thread } from './pages/Thread'
import { Resources, ResourcePage } from './pages/Resources'
import { Search } from './pages/Search'
import { Admin } from './pages/Admin'
import { RequireAuth } from './components/RequireAuth'

const GatedDiscussion = () => (
  <RequireAuth>
    <Discussion />
  </RequireAuth>
)
const GatedThread = (props: { id?: string }) => (
  <RequireAuth>
    <Thread id={props.id ?? ''} />
  </RequireAuth>
)

function Root() {
  return (
    <LocationProvider>
      <App>
        <Router>
          <Route path="/" component={() => <Cfes initialView="reviewed" />} />
          <Route path="/cfes" component={() => <Cfes initialView="all" />} />
          <Route path="/news" component={News} />
          <Route path="/featured" component={Featured} />
          <Route path="/discussion" component={GatedDiscussion} />
          <Route path="/discussion/:id" component={GatedThread} />
          <Route path="/resources" component={Resources} />
          <Route path="/resources/:id" component={ResourcePage} />
          <Route path="/search" component={Search} />
          <Route path="/admin" component={Admin} />
          <Route default component={() => <Cfes initialView="reviewed" />} />
        </Router>
      </App>
    </LocationProvider>
  )
}

render(<Root />, document.getElementById('app')!)
