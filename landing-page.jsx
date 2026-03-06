<Frame name="Modern Web Page" w={1440} flex="col" bg="var:shadcn/semantic/background">
  <Frame name="Navbar" w="fill" h={80} flex="row" items="center" p={24} px={80} bg="var:shadcn/semantic/background">
    <Text size={24} weight="bold" color="var:shadcn/semantic/foreground">VIBE</Text>
    <Frame grow={1} />
    <Frame flex="row" gap={32}>
      <Text size={16} color="var:shadcn/semantic/muted-foreground">Products</Text>
      <Text size={16} color="var:shadcn/semantic/muted-foreground">Services</Text>
      <Text size={16} color="var:shadcn/semantic/muted-foreground">About</Text>
    </Frame>
    <Frame grow={1} />
    <Frame bg="var:shadcn/semantic/primary" px={20} py={10} rounded={8} flex="row" justify="center" items="center">
      <Text size={14} weight="medium" color="var:shadcn/semantic/primary-foreground">Get Started</Text>
    </Frame>
  </Frame>

  <Frame name="Hero" w="fill" h={700} flex="col" justify="center" items="center" gap={32} p={80} bg="var:shadcn/semantic/background">
    <Frame flex="col" gap={16} items="center" w={800} w="fill">
      <Text size={64} weight="bold" color="var:shadcn/semantic/foreground" w="fill" align="center">Design the future of the web</Text>
      <Text size={20} color="var:shadcn/semantic/muted-foreground" w="fill" align="center">A comprehensive design system built for speed, performance, and modern aesthetics.</Text>
    </Frame>
    <Frame flex="row" gap={16}>
      <Frame bg="var:shadcn/semantic/primary" px={32} py={16} rounded={12} flex="row" justify="center" items="center">
        <Text size={16} weight="semibold" color="var:shadcn/semantic/primary-foreground">Build Now</Text>
      </Frame>
      <Frame stroke="var:shadcn/semantic/border" strokeWidth={1} px={32} py={16} rounded={12} flex="row" justify="center" items="center">
        <Text size={16} weight="semibold" color="var:shadcn/semantic/foreground">Documentation</Text>
      </Frame>
    </Frame>
  </Frame>

  <Frame name="Features" w="fill" flex="row" gap={40} p={80} bg="var:shadcn/semantic/muted">
    <Frame flex="col" gap={16} grow={1} p={32} bg="var:shadcn/semantic/background" rounded={16} stroke="var:shadcn/semantic/border" strokeWidth={1}>
      <Frame w={48} h={48} bg="var:shadcn/semantic/primary" rounded={12} />
      <Text size={24} weight="bold" color="var:shadcn/semantic/foreground" w="fill">Lightning Fast</Text>
      <Text size={16} color="var:shadcn/semantic/muted-foreground" w="fill">Optimized for performance and rapid deployment across all platforms.</Text>
    </Frame>
    <Frame flex="col" gap={16} grow={1} p={32} bg="var:shadcn/semantic/background" rounded={16} stroke="var:shadcn/semantic/border" strokeWidth={1}>
      <Frame w={48} h={48} bg="var:shadcn/semantic/accent" rounded={12} />
      <Text size={24} weight="bold" color="var:shadcn/semantic/foreground" w="fill">Scalable Design</Text>
      <Text size={16} color="var:shadcn/semantic/muted-foreground" w="fill">Built to scale with your project from small prototypes to large systems.</Text>
    </Frame>
    <Frame flex="col" gap={16} grow={1} p={32} bg="var:shadcn/semantic/background" rounded={16} stroke="var:shadcn/semantic/border" strokeWidth={1}>
      <Frame w={48} h={48} bg="var:shadcn/semantic/secondary" rounded={12} />
      <Text size={24} weight="bold" color="var:shadcn/semantic/foreground" w="fill">W3C Standard</Text>
      <Text size={16} color="var:shadcn/semantic/muted-foreground" w="fill">Adheres to the latest W3C design token standards for interoperability.</Text>
    </Frame>
  </Frame>

  <Frame name="CTA" w="fill" p={100} flex="col" items="center" gap={32} bg="var:shadcn/semantic/primary">
    <Frame flex="col" gap={16} items="center" w={600} w="fill">
      <Text size={40} weight="bold" color="var:shadcn/semantic/primary-foreground" w="fill" align="center">Ready to start building?</Text>
      <Text size={18} color="var:shadcn/semantic/primary-foreground" opacity={0.8} w="fill" align="center">Join thousands of developers and designers creating amazing experiences.</Text>
    </Frame>
    <Frame bg="var:shadcn/semantic/background" px={40} py={20} rounded={12} flex="row" justify="center" items="center">
      <Text size={18} weight="bold" color="var:shadcn/semantic/primary">Get Started for Free</Text>
    </Frame>
  </Frame>
</Frame>
