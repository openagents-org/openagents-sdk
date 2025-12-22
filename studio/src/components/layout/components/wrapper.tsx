import { Outlet } from 'react-router-dom';
import { useLayout } from './context';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { HeaderBreadcrumbs } from './header-breadcrumbs';

export function Wrapper() {
  const {isMobile} = useLayout();

  return (
    <>
      <Header />
      {!isMobile && <Sidebar />}

      <div className="bg-background lg:border-e lg:border-b lg:border-border grow lg:overflow-y-auto lg:rounded-ee-xl lg:in-data-[sidebar-open=false]:rounded-es-xl lg:in-data-[sidebar-open=false]:border-s pt-(--header-height-mobile) lg:mb-(--page-margin) lg:me-(--page-margin) lg:pt-0 lg:mt-[calc(var(--header-height)+var(--page-margin))] lg:ms-(--sidebar-width) lg:in-data-[sidebar-open=false]:ms-(--sidebar-collapsed-width) transition-all duration-300">    
        <main className="grow py-5 lg:py-7.5" role="content">
          {isMobile && <HeaderBreadcrumbs />}
          <Outlet />
        </main>
      </div>
    </>
  );
}
