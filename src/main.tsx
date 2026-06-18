import { render } from 'preact'
import { LocationProvider, Router, Route } from 'preact-iso'
import './index.css'
import { App } from './app'
import { Home } from './pages/Home'
import { News } from './pages/News'
import { Featured } from './pages/Featured'
import { Discussion } from './pages/Discussion'
import { Thread } from './pages/Thread'
import { Resources, ResourcePage } from './pages/Resources'
import { Search } from './pages/Search'
import { Admin } from './pages/Admin'

function Root() {
  return (
    <LocationProvider>
      <App>
        <Router>
          <Route path="/" component={Home} />
          <Route path="/news" component={News} />
          <Route path="/featured" component={Featured} />
          <Route path="/discussion" component={Discussion} />
          <Route path="/discussion/:id" component={Thread} />
          <Route path="/resources" component={Resources} />
          <Route path="/resources/:id" component={ResourcePage} />
          <Route path="/search" component={Search} />
          <Route path="/admin" component={Admin} />
          <Route default component={Home} />
        </Router>
      </App>
    </LocationProvider>
  )
}

render(<Root />, document.getElementById('app')!)
